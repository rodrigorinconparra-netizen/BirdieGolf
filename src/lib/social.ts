import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  rounds,
  roundHoles,
  courses,
  follows,
  notifications,
  tournaments,
  tournamentParticipants,
} from "@/lib/db/schema";
import { sendPushToUsers } from "@/lib/push";

export interface FeedRound {
  roundId: number;
  userId: number;
  userName: string;
  courseName: string | null;
  coursePar: number | null;
  playedAt: Date;
  totalStrokes: number | null;
  totalPutts: number | null;
  distanceKm: number | null;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function followingIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return rows.map((r) => r.id);
}

export async function searchUsers(query: string, viewerId: number) {
  const q = query.trim();
  if (q.length < 1) return [];
  const rows = await db
    .select({ id: users.id, name: users.name, handicap: users.handicap })
    .from(users)
    .where(and(ilike(users.name, `%${q}%`), ne(users.id, viewerId)))
    .orderBy(asc(users.name))
    .limit(20);
  const following = new Set(await followingIds(viewerId));
  return rows.map((u) => ({ ...u, isFollowing: following.has(u.id) }));
}

/** All other players (for picking playing partners when creating a round). */
export async function listPlayers(viewerId: number) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(ne(users.id, viewerId))
    .orderBy(asc(users.name));
}

export async function getProfile(profileId: number, viewerId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, profileId));
  if (!user) return null;

  const [{ c: followers }] = await db
    .select({ c: count() })
    .from(follows)
    .where(eq(follows.followingId, profileId));
  const [{ c: followingCount }] = await db
    .select({ c: count() })
    .from(follows)
    .where(eq(follows.followerId, profileId));

  const [rel] = await db
    .select({ notify: follows.notify })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, profileId)));

  const pubRounds = await db
    .select({
      roundId: rounds.id,
      playedAt: rounds.playedAt,
      totalStrokes: rounds.totalStrokes,
      totalPutts: rounds.totalPutts,
      courseName: courses.name,
      coursePar: courses.par,
    })
    .from(rounds)
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .where(and(eq(rounds.userId, profileId), eq(rounds.isPublic, true)))
    .orderBy(desc(rounds.playedAt));

  const scored = pubRounds.filter((r) => r.totalStrokes != null);
  const avgStrokes = scored.length
    ? Math.round(scored.reduce((s, r) => s + (r.totalStrokes ?? 0), 0) / scored.length)
    : null;

  const feed: FeedRound[] = pubRounds.map((r) => ({
    roundId: r.roundId,
    userId: profileId,
    userName: user.name,
    courseName: r.courseName,
    coursePar: r.coursePar,
    playedAt: r.playedAt,
    totalStrokes: r.totalStrokes,
    totalPutts: r.totalPutts,
    distanceKm: null,
  }));

  return {
    user: { id: user.id, name: user.name, email: user.email, handicap: user.handicap },
    followers,
    following: followingCount,
    isFollowing: Boolean(rel),
    notify: rel?.notify ?? false,
    isSelf: profileId === viewerId,
    publicRoundCount: pubRounds.length,
    avgStrokes,
    feed,
  };
}

const FEED_SELECT = {
  roundId: rounds.id,
  userId: rounds.userId,
  userName: users.name,
  courseName: courses.name,
  coursePar: courses.par,
  courseLat: courses.lat,
  courseLon: courses.lon,
  playedAt: rounds.playedAt,
  totalStrokes: rounds.totalStrokes,
  totalPutts: rounds.totalPutts,
} as const;

function toFeed(r: {
  roundId: number;
  userId: number;
  userName: string | null;
  courseName: string | null;
  coursePar: number | null;
  playedAt: Date;
  totalStrokes: number | null;
  totalPutts: number | null;
}): FeedRound {
  return {
    roundId: r.roundId,
    userId: r.userId,
    userName: r.userName ?? "Jugador",
    courseName: r.courseName,
    coursePar: r.coursePar,
    playedAt: r.playedAt,
    totalStrokes: r.totalStrokes,
    totalPutts: r.totalPutts,
    distanceKm: null,
  };
}

export async function getFollowingFeed(viewerId: number): Promise<FeedRound[]> {
  const ids = await followingIds(viewerId);
  if (ids.length === 0) return [];
  const rows = await db
    .select(FEED_SELECT)
    .from(rounds)
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .leftJoin(users, eq(rounds.userId, users.id))
    .where(and(inArray(rounds.userId, ids), eq(rounds.isPublic, true)))
    .orderBy(desc(rounds.playedAt))
    .limit(40);
  return rows.map(toFeed);
}

export async function getPublicFeed(
  viewerId: number,
  lat: number | null,
  lon: number | null,
): Promise<FeedRound[]> {
  const rows = await db
    .select(FEED_SELECT)
    .from(rounds)
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .leftJoin(users, eq(rounds.userId, users.id))
    .where(eq(rounds.isPublic, true))
    .orderBy(desc(rounds.playedAt))
    .limit(120);

  const feed = rows.map((r) => {
    const f = toFeed(r);
    if (lat != null && lon != null && r.courseLat != null && r.courseLon != null) {
      f.distanceKm = Math.round(haversineKm(lat, lon, r.courseLat, r.courseLon));
    }
    return f;
  });

  if (lat != null && lon != null) {
    feed.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }
  return feed.slice(0, 40);
}

export async function getPublicRound(roundId: number) {
  const [round] = await db
    .select({
      id: rounds.id,
      userId: rounds.userId,
      isPublic: rounds.isPublic,
      playedAt: rounds.playedAt,
      totalStrokes: rounds.totalStrokes,
      totalPutts: rounds.totalPutts,
      userName: users.name,
      courseName: courses.name,
      coursePar: courses.par,
    })
    .from(rounds)
    .leftJoin(users, eq(rounds.userId, users.id))
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .where(eq(rounds.id, roundId));
  if (!round || !round.isPublic) return null;
  const holes = await db
    .select()
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId))
    .orderBy(asc(roundHoles.holeNumber));
  return { round, holes };
}

/**
 * "Jugar ahora mismo" avisa a los seguidores al crear la vuelta. Si la vuelta
 * sigue SIN terminar (algún hoyo sin golpes) pasados estos días, ese aviso ya no
 * se muestra (vuelta abandonada).
 */
const STALE_ROUND_DAYS = 2;

/** Condition that hides stale, unfinished "round_created" notifications. */
function notStaleUnfinishedRound() {
  return sql`not (
    ${notifications.type} = 'round_created'
    and ${notifications.createdAt} < now() - make_interval(days => ${STALE_ROUND_DAYS})
    and exists (
      select 1 from ${roundHoles} rh
      where rh.round_id = ${notifications.roundId} and rh.strokes is null
    )
  )`;
}

export async function listNotifications(userId: number) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      roundId: notifications.roundId,
      tournamentId: notifications.tournamentId,
      tournamentName: tournaments.name,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actorName: users.name,
      actorId: notifications.actorId,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(tournaments, eq(notifications.tournamentId, tournaments.id))
    .where(and(eq(notifications.userId, userId), notStaleUnfinishedRound()))
    .orderBy(desc(notifications.createdAt))
    .limit(40);
}

/** Notify followers (who enabled the bell) that the user created a new round. */
export async function notifyFollowersRoundCreated(
  actorId: number,
  roundId: number,
): Promise<void> {
  const followers = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followingId, actorId), eq(follows.notify, true)));
  if (followers.length === 0) return;
  await db.insert(notifications).values(
    followers.map((f) => ({
      userId: f.followerId,
      actorId,
      roundId,
      type: "round_created",
    })),
  );

  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId));
  await sendPushToUsers(
    followers.map((f) => f.followerId),
    {
      title: "Birdie",
      body: `${actor?.name ?? "Alguien"} ha registrado una vuelta nueva`,
      data: { type: "round_created", roundId: String(roundId) },
    },
  );
}

/** Notify every member of a league that a new tournament was created in it. */
export async function notifyLeagueTournamentCreated(
  actorId: number,
  leagueId: number,
  tournamentId: number,
): Promise<void> {
  const children = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.parentId, leagueId));
  const ids = [leagueId, ...children.map((c) => c.id)];

  const parts = await db
    .selectDistinct({ userId: tournamentParticipants.userId })
    .from(tournamentParticipants)
    .where(inArray(tournamentParticipants.tournamentId, ids));

  const recipients = parts.map((p) => p.userId).filter((uid) => uid !== actorId);
  if (recipients.length === 0) return;
  await db.insert(notifications).values(
    recipients.map((uid) => ({
      userId: uid,
      actorId,
      tournamentId,
      type: "tournament_created",
    })),
  );

  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId));
  await sendPushToUsers(recipients, {
    title: "Birdie · Liga",
    body: `${actor?.name ?? "Alguien"} ha creado un torneo en una liga`,
    data: { type: "tournament_created", tournamentId: String(tournamentId) },
  });
}

export async function unreadNotificationCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false),
        notStaleUnfinishedRound(),
      ),
    );
  return row?.c ?? 0;
}
