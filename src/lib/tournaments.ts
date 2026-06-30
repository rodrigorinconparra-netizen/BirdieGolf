import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentSlots,
  tournamentParticipants,
  tournamentGroups,
  courses,
  users,
} from "@/lib/db/schema";

export function generateInviteCode(): string {
  return (
    Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
  );
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = h * 60 + m + mins;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface SlotPlayer {
  participantId: number;
  userId: number;
  name: string;
}
export interface SlotGroup {
  index: number;
  teeTime: string;
  players: SlotPlayer[];
}

/** Splits a slot's players into groups of 4 and assigns tee times. */
export function buildSlotGroups(
  players: SlotPlayer[],
  startTime: string,
  startType: "shotgun" | "progressive",
  intervalMinutes: number,
): SlotGroup[] {
  const groups: SlotGroup[] = [];
  for (let i = 0; i < players.length; i += 4) {
    const idx = i / 4;
    groups.push({
      index: idx,
      teeTime: startType === "progressive" ? addMinutes(startTime, idx * intervalMinutes) : startTime,
      players: players.slice(i, i + 4),
    });
  }
  if (groups.length === 0) {
    groups.push({ index: 0, teeTime: startTime, players: [] });
  }
  return groups;
}

export async function listTournaments(userId: number) {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      visibility: tournaments.visibility,
      format: tournaments.format,
      playDate: tournaments.playDate,
      status: tournaments.status,
      ownerId: tournaments.ownerId,
      parentId: tournaments.parentId,
      courseName: courses.name,
    })
    .from(tournaments)
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .orderBy(desc(tournaments.createdAt));

  const myParts = await db
    .select({ tournamentId: tournamentParticipants.tournamentId })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.userId, userId));
  const mine = new Set(myParts.map((p) => p.tournamentId));

  // Only top-level items (leagues + standalone tournaments); events live inside a league.
  return rows
    .filter(
      (t) =>
        t.parentId == null &&
        (t.visibility === "public" || t.ownerId === userId || mine.has(t.id)),
    )
    .map((t) => ({ ...t, joined: mine.has(t.id), owned: t.ownerId === userId }));
}

/** Default settings stored on a league, used to pre-fill its tournaments. */
export async function getTournamentDefaults(id: number) {
  const [t] = await db
    .select({
      courseId: tournaments.courseId,
      startType: tournaments.startType,
      intervalMinutes: tournaments.intervalMinutes,
      visibility: tournaments.visibility,
    })
    .from(tournaments)
    .where(eq(tournaments.id, id));
  return t ?? null;
}

export async function getLeagueChildren(leagueId: number) {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      playDate: tournaments.playDate,
      status: tournaments.status,
      courseName: courses.name,
    })
    .from(tournaments)
    .leftJoin(courses, eq(tournaments.courseId, courses.id))
    .where(eq(tournaments.parentId, leagueId))
    .orderBy(asc(tournaments.playDate), asc(tournaments.id));
  if (rows.length === 0) return [];

  const counts = await db
    .select({ tournamentId: tournamentParticipants.tournamentId, n: count() })
    .from(tournamentParticipants)
    .where(inArray(tournamentParticipants.tournamentId, rows.map((r) => r.id)))
    .groupBy(tournamentParticipants.tournamentId);
  const countMap = new Map(counts.map((c) => [c.tournamentId, c.n]));

  return rows.map((r) => ({ ...r, players: countMap.get(r.id) ?? 0 }));
}

/** Round ids a player has signed across all tournaments inside a league. */
export async function getLeagueRoundIds(leagueId: number, userId: number): Promise<number[]> {
  const children = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.parentId, leagueId));
  const ids = children.map((c) => c.id);
  if (ids.length === 0) return [];
  const parts = await db
    .select({ roundId: tournamentParticipants.roundId })
    .from(tournamentParticipants)
    .where(
      and(
        inArray(tournamentParticipants.tournamentId, ids),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  return parts.map((p) => p.roundId).filter((x): x is number => x != null);
}

/** Round id(s) a player has signed in a single tournament. */
export async function getTournamentRoundIds(
  tournamentId: number,
  userId: number,
): Promise<number[]> {
  const parts = await db
    .select({ roundId: tournamentParticipants.roundId })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  return parts.map((p) => p.roundId).filter((x): x is number => x != null);
}

export async function getLeagueStandings(leagueId: number) {
  const children = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.parentId, leagueId));
  const ids = children.map((c) => c.id);
  if (ids.length === 0) return [];

  const parts = await db
    .select({ userId: tournamentParticipants.userId, name: users.name })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(inArray(tournamentParticipants.tournamentId, ids));

  const map = new Map<number, { userId: number; name: string; events: number }>();
  for (const p of parts) {
    const e = map.get(p.userId) ?? { userId: p.userId, name: p.name ?? "Jugador", events: 0 };
    e.events++;
    map.set(p.userId, e);
  }
  return [...map.values()].sort((a, b) => b.events - a.events);
}

export async function getTournament(id: number, userId: number) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!t) return null;

  const course = t.courseId
    ? ((await db.select().from(courses).where(eq(courses.id, t.courseId)))[0] ?? null)
    : null;
  const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.id, t.ownerId));

  const slots = await db
    .select()
    .from(tournamentSlots)
    .where(eq(tournamentSlots.tournamentId, id))
    .orderBy(asc(tournamentSlots.position), asc(tournamentSlots.startTime));

  const participants = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      slotId: tournamentParticipants.slotId,
      groupId: tournamentParticipants.groupId,
      isOrganizer: tournamentParticipants.isOrganizer,
      joinedAt: tournamentParticipants.joinedAt,
      name: users.name,
    })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(eq(tournamentParticipants.tournamentId, id))
    .orderBy(asc(tournamentParticipants.joinedAt));

  const me = participants.find((p) => p.userId === userId) ?? null;
  const organizers = participants.filter((p) => p.isOrganizer || p.userId === t.ownerId);

  const parent = t.parentId
    ? ((
        await db
          .select({ id: tournaments.id, name: tournaments.name })
          .from(tournaments)
          .where(eq(tournaments.id, t.parentId))
      )[0] ?? null)
    : null;

  const groups = await db
    .select()
    .from(tournamentGroups)
    .where(eq(tournamentGroups.tournamentId, id))
    .orderBy(asc(tournamentGroups.position));

  const now = Date.now();
  const registrationOpen = !t.registrationDeadline || now < t.registrationDeadline.getTime();
  const deadlinePassed = !!t.registrationDeadline && now >= t.registrationDeadline.getTime();
  const started = !t.startsAt || now >= t.startsAt.getTime();
  const pairingsVisible =
    t.pairingsPublished ||
    (t.pairingsMode === "auto" &&
      !!t.pairingsPublishAt &&
      now >= t.pairingsPublishAt.getTime());

  const isOwner = t.ownerId === userId;
  // An organizer (co-creator) can manage the same as the owner, except deleting
  // the league/tournament and adding/removing other organizers (owner-only).
  // League events also inherit management from the parent league's organizers.
  let canManage = isOwner || (me?.isOrganizer ?? false);
  if (!canManage && t.parentId) {
    const [pl] = await db
      .select({ ownerId: tournaments.ownerId })
      .from(tournaments)
      .where(eq(tournaments.id, t.parentId));
    if (pl?.ownerId === userId) {
      canManage = true;
    } else {
      const [po] = await db
        .select({ isOrganizer: tournamentParticipants.isOrganizer })
        .from(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, t.parentId),
            eq(tournamentParticipants.userId, userId),
          ),
        );
      canManage = po?.isOrganizer === true;
    }
  }

  return {
    tournament: t,
    course,
    ownerName: owner?.name ?? "",
    slots,
    participants,
    organizers,
    groups,
    me,
    parent,
    isOwner,
    canManage,
    isMember: Boolean(me),
    registrationOpen,
    deadlinePassed,
    started,
    pairingsVisible,
  };
}

export async function generateGroups(tournamentId: number): Promise<void> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return;
  const slots = await db
    .select()
    .from(tournamentSlots)
    .where(eq(tournamentSlots.tournamentId, tournamentId))
    .orderBy(asc(tournamentSlots.position), asc(tournamentSlots.startTime));

  // Clear existing groups (FK ON DELETE SET NULL clears participant.groupId).
  await db.delete(tournamentGroups).where(eq(tournamentGroups.tournamentId, tournamentId));

  let pos = 0;
  for (const slot of slots) {
    const parts = await db
      .select({ id: tournamentParticipants.id })
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.slotId, slot.id),
        ),
      )
      .orderBy(asc(tournamentParticipants.joinedAt));

    for (let i = 0; i < parts.length; i += 4) {
      const idx = i / 4;
      const teeTime =
        t.startType === "progressive" ? addMinutes(slot.startTime, idx * t.intervalMinutes) : slot.startTime;
      const startHole = t.startType === "shotgun" ? (pos % 18) + 1 : null;
      const [g] = await db
        .insert(tournamentGroups)
        .values({ tournamentId, slotId: slot.id, teeTime, startHole, position: pos })
        .returning({ id: tournamentGroups.id });
      for (const p of parts.slice(i, i + 4)) {
        await db
          .update(tournamentParticipants)
          .set({ groupId: g.id })
          .where(eq(tournamentParticipants.id, p.id));
      }
      pos++;
    }
  }
}
