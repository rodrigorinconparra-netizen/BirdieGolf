"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentParticipants,
  tournamentHoleScores,
  rounds,
  roundHoles,
  holes as courseHoles,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import type { FairwayValue } from "@/app/(app)/rounds/actions";

async function myParticipant(tournamentId: number, userId: number) {
  const [p] = await db
    .select()
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  return p ?? null;
}

export async function chooseMarkerAction(
  tournamentId: number,
  markerParticipantId: number,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const me = await myParticipant(tournamentId, session.userId);
  if (!me) return { error: "No estás en el torneo" };

  const [marker] = await db
    .select()
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.id, markerParticipantId));
  if (!marker || marker.tournamentId !== tournamentId || marker.slotId !== me.slotId) {
    return { error: "Marcador no válido" };
  }

  // Mutual pairing
  await db.update(tournamentParticipants).set({ markerId: marker.id }).where(eq(tournamentParticipants.id, me.id));
  await db.update(tournamentParticipants).set({ markerId: me.id }).where(eq(tournamentParticipants.id, marker.id));
  revalidatePath(`/tournaments/${tournamentId}/play`);
  return { ok: true };
}

export async function toggleDetailAction(
  tournamentId: number,
  wantsDetail: boolean,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const me = await myParticipant(tournamentId, session.userId);
  if (!me) return;
  await db
    .update(tournamentParticipants)
    .set({ wantsDetail })
    .where(eq(tournamentParticipants.id, me.id));
  revalidatePath(`/tournaments/${tournamentId}/play`);
}

export interface HoleScoreDetail {
  selfPutts: number | null;
  fairway: FairwayValue;
  teeClub: string | null;
  teeDistanceMeters: number | null;
  approachClub: string | null;
  approachDistanceMeters: number | null;
  approachResult: FairwayValue;
  sand: boolean | null;
  firstPuttDistanceMeters: number | null;
  puttResult: FairwayValue;
  penalties: number | null;
}

export async function saveHoleScoreAction(
  tournamentId: number,
  holeNumber: number,
  par: number | null,
  selfStrokes: number | null,
  markStrokes: number | null,
  detail: HoleScoreDetail,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const me = await myParticipant(tournamentId, session.userId);
  if (!me) return { error: "No estás en el torneo" };
  if (me.signed) return { error: "Tarjeta ya firmada" };

  // My own score + optional full detail
  const mine = {
    selfStrokes,
    par,
    selfPutts: detail.selfPutts,
    fairway: detail.fairway,
    teeClub: detail.teeClub,
    teeDistanceMeters: detail.teeDistanceMeters,
    approachClub: detail.approachClub,
    approachDistanceMeters: detail.approachDistanceMeters,
    approachResult: detail.approachResult,
    sand: detail.sand,
    firstPuttDistanceMeters: detail.firstPuttDistanceMeters,
    puttResult: detail.puttResult,
    penalties: detail.penalties,
  };
  await db
    .insert(tournamentHoleScores)
    .values({ tournamentId, participantId: me.id, holeNumber, ...mine })
    .onConflictDoUpdate({
      target: [tournamentHoleScores.participantId, tournamentHoleScores.holeNumber],
      set: mine,
    });

  // The score I record for my marker → their markerStrokes
  if (me.markerId) {
    await db
      .insert(tournamentHoleScores)
      .values({
        tournamentId,
        participantId: me.markerId,
        holeNumber,
        par,
        markerStrokes: markStrokes,
      })
      .onConflictDoUpdate({
        target: [tournamentHoleScores.participantId, tournamentHoleScores.holeNumber],
        set: { markerStrokes: markStrokes, par },
      });
  }

  revalidatePath(`/tournaments/${tournamentId}/play`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true };
}

type ParticipantRow = NonNullable<Awaited<ReturnType<typeof myParticipant>>>;
type TournamentRow = typeof tournaments.$inferSelect;

/** Required holes (course pars, or 18 par-4) for a tournament. */
async function requiredHoles(t: TournamentRow): Promise<{ number: number; par: number }[]> {
  if (t.courseId) {
    const ch = await db
      .select({ number: courseHoles.number, par: courseHoles.par })
      .from(courseHoles)
      .where(eq(courseHoles.courseId, t.courseId))
      .orderBy(asc(courseHoles.number));
    if (ch.length) return ch;
  }
  return Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 }));
}

/**
 * Creates/updates the participant's real round from their tournament scores
 * (self strokes + full detail), linking participant.roundId. Idempotent — saving
 * again just refreshes the round. Feeds Mis Vueltas / estadísticas.
 */
async function materializeRound(me: ParticipantRow, t: TournamentRow): Promise<number> {
  const required = await requiredHoles(t);
  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.participantId, me.id));
  const byHole = new Map(scores.map((s) => [s.holeNumber, s]));

  let roundId = me.roundId;
  if (!roundId) {
    const [round] = await db
      .insert(rounds)
      .values({
        userId: me.userId,
        courseId: t.courseId,
        playedAt: t.playDate ?? new Date(),
        notes: `Torneo: ${t.name}`,
        notified: true,
      })
      .returning();
    roundId = round.id;
    await db
      .update(tournamentParticipants)
      .set({ roundId })
      .where(eq(tournamentParticipants.id, me.id));
  }

  await db.delete(roundHoles).where(eq(roundHoles.roundId, roundId));
  await db.insert(roundHoles).values(
    required.map((h) => {
      const s = byHole.get(h.number);
      const strokes = s?.selfStrokes ?? null;
      const putts = s?.selfPutts ?? null;
      const gir =
        strokes != null && putts != null && h.par != null ? strokes - putts <= h.par - 2 : null;
      return {
        roundId: roundId!,
        holeNumber: h.number,
        par: h.par,
        strokes,
        putts,
        penalties: s?.penalties ?? 0,
        fairway: s?.fairway ?? null,
        teeClub: s?.teeClub ?? null,
        teeDistanceMeters: s?.teeDistanceMeters ?? null,
        approachClub: s?.approachClub ?? null,
        approachDistanceMeters: s?.approachDistanceMeters ?? null,
        approachResult: s?.approachResult ?? null,
        sand: s?.sand ?? null,
        firstPuttDistanceMeters: s?.firstPuttDistanceMeters ?? null,
        puttResult: s?.puttResult ?? null,
        greenInRegulation: gir,
      };
    }),
  );
  const totalStrokes =
    required.reduce((acc, h) => acc + (byHole.get(h.number)?.selfStrokes ?? 0), 0) || null;
  const totalPutts =
    required.reduce((acc, h) => acc + (byHole.get(h.number)?.selfPutts ?? 0), 0) || null;
  await db.update(rounds).set({ totalStrokes, totalPutts }).where(eq(rounds.id, roundId));
  return roundId;
}

/** Save my tournament round to Mis Vueltas (no marker verification required). */
export async function saveMyRoundAction(
  tournamentId: number,
): Promise<{ ok?: boolean; error?: string; roundId?: number }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const me = await myParticipant(tournamentId, session.userId);
  if (!me) return { error: "No estás en el torneo" };
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return { error: "Torneo no encontrado" };

  const required = await requiredHoles(t);
  const scores = await db
    .select({ holeNumber: tournamentHoleScores.holeNumber, selfStrokes: tournamentHoleScores.selfStrokes })
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.participantId, me.id));
  const byHole = new Map(scores.map((s) => [s.holeNumber, s]));
  const allEntered = required.every((h) => byHole.get(h.number)?.selfStrokes != null);
  if (!allEntered) {
    return { error: "Apunta tu resultado en todos los hoyos para guardar la vuelta." };
  }

  const roundId = await materializeRound(me, t);
  revalidatePath(`/tournaments/${tournamentId}/play`);
  revalidatePath("/rounds");
  return { ok: true, roundId };
}

/** Owner or organizer of the tournament (or of its parent league). */
async function isOrganizerOf(
  tournamentId: number,
  userId: number,
): Promise<{ isOrg: boolean; parentId: number | null }> {
  const [t] = await db
    .select({ ownerId: tournaments.ownerId, parentId: tournaments.parentId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  if (!t) return { isOrg: false, parentId: null };
  if (t.ownerId === userId) return { isOrg: true, parentId: t.parentId };
  const [p] = await db
    .select({ isOrganizer: tournamentParticipants.isOrganizer })
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.userId, userId),
      ),
    );
  return { isOrg: p?.isOrganizer === true, parentId: t.parentId };
}

async function canManageTournament(tournamentId: number, userId: number): Promise<boolean> {
  const a = await isOrganizerOf(tournamentId, userId);
  if (a.isOrg) return true;
  if (a.parentId) return (await isOrganizerOf(a.parentId, userId)).isOrg;
  return false;
}

/**
 * Organizer signs a player's card on their behalf (e.g. the player forgot to
 * sign). Only allowed when every hole is complete AND verified (self === marker).
 */
export async function signParticipantCardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tournamentId = Number(formData.get("tournamentId"));
  const participantId = Number(formData.get("participantId"));
  if (!tournamentId || !participantId) return;
  if (!(await canManageTournament(tournamentId, session.userId))) return;

  const [p] = await db
    .select()
    .from(tournamentParticipants)
    .where(
      and(
        eq(tournamentParticipants.id, participantId),
        eq(tournamentParticipants.tournamentId, tournamentId),
      ),
    );
  if (!p || p.signed) {
    revalidatePath(`/tournaments/${tournamentId}`);
    return;
  }
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return;

  const required = await requiredHoles(t);
  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.participantId, p.id));
  const byHole = new Map(scores.map((s) => [s.holeNumber, s]));
  for (const h of required) {
    const s = byHole.get(h.number);
    if (!s || s.selfStrokes == null || s.markerStrokes == null || s.selfStrokes !== s.markerStrokes) {
      return; // not complete/verified → no-op (button only shows when eligible)
    }
  }

  await materializeRound(p, t);
  await db
    .update(tournamentParticipants)
    .set({ signed: true, signedAt: new Date() })
    .where(eq(tournamentParticipants.id, p.id));

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/play`);
  revalidatePath("/rounds");
}

export async function signCardAction(
  tournamentId: number,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const me = await myParticipant(tournamentId, session.userId);
  if (!me) return { error: "No estás en el torneo" };
  if (me.signed) return { ok: true };

  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return { error: "Torneo no encontrado" };

  const required = await requiredHoles(t);
  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.participantId, me.id));
  const byHole = new Map(scores.map((s) => [s.holeNumber, s]));

  for (const h of required) {
    const s = byHole.get(h.number);
    if (!s || s.selfStrokes == null || s.markerStrokes == null || s.selfStrokes !== s.markerStrokes) {
      return { error: "Hay hoyos sin verificar. Revisa los avisos antes de firmar." };
    }
  }

  await materializeRound(me, t);
  await db
    .update(tournamentParticipants)
    .set({ signed: true, signedAt: new Date() })
    .where(eq(tournamentParticipants.id, me.id));

  revalidatePath(`/tournaments/${tournamentId}/play`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/rounds");
  return { ok: true };
}
