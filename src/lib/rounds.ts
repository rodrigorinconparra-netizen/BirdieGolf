import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rounds, roundHoles, courses, holes, teeHoleDistances, users } from "@/lib/db/schema";
import { getRoundPartners } from "@/lib/round-players";

export async function listRounds(userId: number) {
  return db
    .select({
      id: rounds.id,
      playedAt: rounds.playedAt,
      totalStrokes: rounds.totalStrokes,
      totalPutts: rounds.totalPutts,
      courseName: courses.name,
      coursePar: courses.par,
    })
    .from(rounds)
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .where(eq(rounds.userId, userId))
    .orderBy(desc(rounds.playedAt));
}

export async function getRound(id: number, userId: number) {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.id, id), eq(rounds.userId, userId)));
  if (!round) return null;

  const course = round.courseId
    ? ((await db.select().from(courses).where(eq(courses.id, round.courseId)))[0] ?? null)
    : null;

  const [owner] = await db
    .select({ handicap: users.handicap })
    .from(users)
    .where(eq(users.id, round.userId));
  const handicap = owner?.handicap ?? null;

  const roundHoleRows = await db
    .select()
    .from(roundHoles)
    .where(eq(roundHoles.roundId, id))
    .orderBy(roundHoles.holeNumber);

  // Total length per hole: prefer the round's tee (barra) distances, else the
  // course hole length. Used to auto-derive the tee shot distance.
  const holeDistances: Record<number, number | null> = {};
  if (round.courseId) {
    const courseHoles = await db
      .select({ number: holes.number, dist: holes.distanceMeters })
      .from(holes)
      .where(eq(holes.courseId, round.courseId));
    for (const h of courseHoles) holeDistances[h.number] = h.dist;
  }
  if (round.teeId) {
    const teeDists = await db
      .select({ holeNumber: teeHoleDistances.holeNumber, meters: teeHoleDistances.meters })
      .from(teeHoleDistances)
      .where(eq(teeHoleDistances.teeId, round.teeId));
    for (const d of teeDists) {
      if (d.meters != null) holeDistances[d.holeNumber] = d.meters;
    }
  }

  const partners = await getRoundPartners(id);

  return { round, course, holes: roundHoleRows, holeDistances, handicap, partners };
}
