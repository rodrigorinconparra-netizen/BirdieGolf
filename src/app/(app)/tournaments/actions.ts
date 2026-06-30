"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentSlots,
  tournamentParticipants,
  tournamentGroups,
  users,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { generateInviteCode, generateGroups } from "@/lib/tournaments";
import { notifyLeagueTournamentCreated } from "@/lib/social";

function parseDateTime(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  return s ? new Date(s) : null;
}

/** Ensures the user is a participant (creating the row if they may join). Returns the participant id or null if no access. */
async function ensureMembership(
  tournamentId: number,
  userId: number,
  invite: string | null,
): Promise<number | null> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return null;

  const [existing] = await db
    .select({ id: tournamentParticipants.id })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  if (existing) return existing.id;

  const canJoin =
    t.visibility === "public" || t.ownerId === userId || (invite && invite === t.inviteCode);
  if (!canJoin) return null;

  const [row] = await db
    .insert(tournamentParticipants)
    .values({ tournamentId, userId, isOrganizer: t.ownerId === userId })
    .returning({ id: tournamentParticipants.id });
  return row.id;
}

export async function createTournamentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/tournaments/new");

  const parentId = Number(formData.get("parentId")) || null;
  // Events inside a league are always single; only a top-level can be a league container.
  const format = parentId
    ? "single"
    : formData.get("format") === "league"
      ? "league"
      : "single";
  const courseId = Number(formData.get("courseId")) || null;
  let visibility: "public" | "private" =
    formData.get("visibility") === "private" ? "private" : "public";
  // In-league events inherit the league's visibility (it isn't asked).
  if (parentId) {
    const [lg] = await db
      .select({ visibility: tournaments.visibility })
      .from(tournaments)
      .where(eq(tournaments.id, parentId));
    if (lg) visibility = lg.visibility;
  }
  const startType = formData.get("startType") === "shotgun" ? "shotgun" : "progressive";
  const intervalMinutes = Number(formData.get("intervalMinutes")) || 10;
  const scoringRaw = String(formData.get("scoringFormat") ?? "stroke");
  const scoringFormat = (
    ["stroke", "stroke_net", "stableford", "stableford_net"].includes(scoringRaw)
      ? scoringRaw
      : "stroke"
  ) as "stroke" | "stroke_net" | "stableford" | "stableford_net";
  const teeId = Number(formData.get("teeId")) || null;
  const dateStr = String(formData.get("playDate") ?? "");
  const playDate = dateStr ? new Date(dateStr) : null;
  const startsAt = parseDateTime(formData.get("startsAt"));
  const registrationDeadline = parseDateTime(formData.get("registrationDeadline"));
  const pairingsMode = formData.get("pairingsMode") === "manual" ? "manual" : "auto";
  const pairingsPublishAt = parseDateTime(formData.get("pairingsPublishAt"));

  const [t] = await db
    .insert(tournaments)
    .values({
      ownerId: session.userId,
      parentId,
      name,
      courseId,
      visibility,
      format,
      scoringFormat,
      teeId,
      startType,
      intervalMinutes,
      playDate,
      startsAt,
      registrationDeadline,
      pairingsMode,
      pairingsPublishAt,
      inviteCode: generateInviteCode(),
    })
    .returning();

  await db
    .insert(tournamentParticipants)
    .values({ tournamentId: t.id, userId: session.userId, isOrganizer: true });

  // Optional initial slots (not for league containers): "09:30, 15:30"
  if (format !== "league") {
    const times = String(formData.get("slots") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{1,2}:\d{2}$/.test(s));
    if (times.length) {
      await db.insert(tournamentSlots).values(
        times.map((time, i) => ({ tournamentId: t.id, startTime: time, position: i })),
      );
    }
  }

  // A tournament created inside a league → notify every member of the league.
  if (parentId) {
    await notifyLeagueTournamentCreated(session.userId, parentId, t.id);
  }

  revalidatePath("/tournaments");
  redirect(`/tournaments/${t.id}`);
}

async function isOwner(tournamentId: number, userId: number): Promise<boolean> {
  const [t] = await db
    .select({ ownerId: tournaments.ownerId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  return t?.ownerId === userId;
}

/** True if the user is an owner/organizer of this tournament (or of its parent league). */
async function isOrganizerOf(tournamentId: number, userId: number): Promise<boolean> {
  const [t] = await db
    .select({ ownerId: tournaments.ownerId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!t) return false;
  if (t.ownerId === userId) return true;
  const [p] = await db
    .select({ isOrganizer: tournamentParticipants.isOrganizer })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  return p?.isOrganizer === true;
}

/**
 * True if the user can manage this tournament: an owner/organizer of it, or — when
 * it's a league event — an owner/organizer of the parent league.
 */
async function canManage(tournamentId: number, userId: number): Promise<boolean> {
  if (await isOrganizerOf(tournamentId, userId)) return true;
  const [t] = await db
    .select({ parentId: tournaments.parentId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (t?.parentId) return isOrganizerOf(t.parentId, userId);
  return false;
}

export async function addSlotAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const startTime = String(formData.get("startTime") ?? "").trim();
  if (!tournamentId || !/^\d{1,2}:\d{2}$/.test(startTime)) return;
  if (!(await canManage(tournamentId, session.userId))) return;
  const [last] = await db
    .select({ position: tournamentSlots.position })
    .from(tournamentSlots)
    .where(eq(tournamentSlots.tournamentId, tournamentId))
    .orderBy(desc(tournamentSlots.position))
    .limit(1);
  await db.insert(tournamentSlots).values({
    tournamentId,
    startTime,
    position: (last?.position ?? -1) + 1,
  });
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function deleteSlotAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const slotId = Number(formData.get("slotId"));
  if (!tournamentId || !slotId) return;
  if (!(await canManage(tournamentId, session.userId))) return;
  await db.delete(tournamentSlots).where(eq(tournamentSlots.id, slotId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function signUpToSlotAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const slotId = Number(formData.get("slotId"));
  const invite = (String(formData.get("invite") ?? "").trim() || null) as string | null;
  if (!tournamentId || !slotId) return;

  const [tour] = await db
    .select({ registrationDeadline: tournaments.registrationDeadline, ownerId: tournaments.ownerId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!tour) return;
  const closed =
    tour.registrationDeadline != null && Date.now() >= tour.registrationDeadline.getTime();
  if (closed && !(await canManage(tournamentId, session.userId))) return; // inscripción cerrada

  const participantId = await ensureMembership(tournamentId, session.userId, invite);
  if (!participantId) return;
  await db
    .update(tournamentParticipants)
    .set({ slotId })
    .where(eq(tournamentParticipants.id, participantId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function leaveSlotAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId) return;
  await db
    .update(tournamentParticipants)
    .set({ slotId: null })
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, session.userId),
      ),
    );
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function joinTournamentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const invite = (String(formData.get("invite") ?? "").trim() || null) as string | null;
  if (!tournamentId) return;
  await ensureMembership(tournamentId, session.userId, invite);
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function leaveTournamentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId) return;
  if (await isOwner(tournamentId, session.userId)) return; // owner can't leave
  await db
    .delete(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, session.userId),
      ),
    );
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function deleteTournamentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId) return;
  if (!(await isOwner(tournamentId, session.userId))) return;
  await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
  revalidatePath("/tournaments");
  redirect("/tournaments");
}

/* ---- Admin: partidas (groups) management ---- */

export async function generatePairingsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId || !(await canManage(tournamentId, session.userId))) return;
  await generateGroups(tournamentId);
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function publishPairingsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId || !(await canManage(tournamentId, session.userId))) return;
  await db
    .update(tournaments)
    .set({ pairingsPublished: true })
    .where(eq(tournaments.id, tournamentId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function updateGroupAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const groupId = Number(formData.get("groupId"));
  if (!tournamentId || !groupId || !(await canManage(tournamentId, session.userId))) return;
  const teeTime = String(formData.get("teeTime") ?? "").trim() || null;
  const startHoleRaw = formData.get("startHole");
  const startHole = startHoleRaw ? Number(startHoleRaw) || null : null;
  await db.update(tournamentGroups).set({ teeTime, startHole }).where(eq(tournamentGroups.id, groupId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function addGroupAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const slotId = Number(formData.get("slotId"));
  if (!tournamentId || !slotId || !(await canManage(tournamentId, session.userId))) return;
  const [last] = await db
    .select({ position: tournamentGroups.position })
    .from(tournamentGroups)
    .where(eq(tournamentGroups.tournamentId, tournamentId))
    .orderBy(desc(tournamentGroups.position))
    .limit(1);
  await db
    .insert(tournamentGroups)
    .values({ tournamentId, slotId, position: (last?.position ?? -1) + 1 });
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const groupId = Number(formData.get("groupId"));
  if (!tournamentId || !groupId || !(await canManage(tournamentId, session.userId))) return;
  await db.delete(tournamentGroups).where(eq(tournamentGroups.id, groupId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function moveParticipantAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const participantId = Number(formData.get("participantId"));
  const groupId = Number(formData.get("groupId")) || null;
  if (!tournamentId || !participantId || !(await canManage(tournamentId, session.userId))) return;
  // When assigning to a group, also align the participant's slot to that group's slot.
  let slotId: number | undefined;
  if (groupId) {
    const [g] = await db
      .select({ slotId: tournamentGroups.slotId })
      .from(tournamentGroups)
      .where(eq(tournamentGroups.id, groupId));
    slotId = g?.slotId;
  }
  await db
    .update(tournamentParticipants)
    .set({ groupId, ...(slotId ? { slotId } : {}) })
    .where(eq(tournamentParticipants.id, participantId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

export async function removeParticipantAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const participantId = Number(formData.get("participantId"));
  if (!tournamentId || !participantId || !(await canManage(tournamentId, session.userId))) return;
  await db.delete(tournamentParticipants).where(eq(tournamentParticipants.id, participantId));
  revalidatePath(`/tournaments/${tournamentId}`);
}

/* ---- Edit league + organizers (co-creators) ---- */

export async function updateLeagueAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const tournamentId = Number(formData.get("tournamentId"));
  if (!tournamentId || !(await canManage(tournamentId, session.userId))) return;

  const name = String(formData.get("name") ?? "").trim();
  const courseId = Number(formData.get("courseId")) || null;
  const visibility: "public" | "private" =
    formData.get("visibility") === "private" ? "private" : "public";
  const startType = formData.get("startType") === "shotgun" ? "shotgun" : "progressive";
  const intervalMinutes = Number(formData.get("intervalMinutes")) || 10;

  const set: Record<string, unknown> = { courseId, visibility, startType, intervalMinutes };
  if (name) set.name = name;
  await db.update(tournaments).set(set).where(eq(tournaments.id, tournamentId));

  revalidatePath(`/tournaments/${tournamentId}`);
  redirect(`/tournaments/${tournamentId}`);
}

/** Owner-only: promote a user (by email) to co-organizer of the league/tournament. */
export async function addOrganizerAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!tournamentId || !email) return;
  if (!(await isOwner(tournamentId, session.userId))) return; // only the creator manages organizers

  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!u) return; // no such user

  const [existing] = await db
    .select({ id: tournamentParticipants.id })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, u.id),
      ),
    );
  if (existing) {
    await db
      .update(tournamentParticipants)
      .set({ isOrganizer: true })
      .where(eq(tournamentParticipants.id, existing.id));
  } else {
    await db
      .insert(tournamentParticipants)
      .values({ tournamentId, userId: u.id, isOrganizer: true });
  }
  revalidatePath(`/tournaments/${tournamentId}`);
}

/** Owner-only: demote a co-organizer back to a regular member (never the owner). */
export async function removeOrganizerAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const participantId = Number(formData.get("participantId"));
  if (!tournamentId || !participantId) return;
  if (!(await isOwner(tournamentId, session.userId))) return;

  const [t] = await db
    .select({ ownerId: tournaments.ownerId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  const [p] = await db
    .select({ userId: tournamentParticipants.userId })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.id, participantId));
  if (!t || !p || p.userId === t.ownerId) return; // can't demote the creator

  await db
    .update(tournamentParticipants)
    .set({ isOrganizer: false })
    .where(eq(tournamentParticipants.id, participantId));
  revalidatePath(`/tournaments/${tournamentId}`);
}
