import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentGroups,
  tournamentParticipants,
  tournamentHoleScores,
  courses,
  holes as courseHolesTable,
  courseTees,
  clubs,
  users,
} from "@/lib/db/schema";
import type { FairwayValue } from "@/app/(app)/rounds/actions";

export interface PlayHole {
  holeNumber: number;
  par: number;
  selfStrokes: number | null;
  selfPutts: number | null;
  markerStrokes: number | null; // what my marker recorded for me
  markStrokes: number | null; // what I recorded for my marker (their markerStrokes)
  markerSelfStrokes: number | null; // what my marker recorded for themselves
  // Optional full detail (when "detalle" is on)
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
  holeDistanceMeters: number | null;
}

export interface GroupMember {
  participantId: number;
  userId: number;
  name: string;
}

export interface PlayBagClub {
  id: number;
  name: string;
  kind: string;
}

export type PlayState =
  | { status: "not_member" }
  | { status: "no_slot" }
  | { status: "not_started"; startsAtLabel: string | null }
  | { status: "no_group" }
  | {
      status: "ok";
      tournamentId: number;
      participantId: number;
      wantsDetail: boolean;
      signed: boolean;
      canEnter: boolean;
      teeTimeLabel: string | null;
      group: GroupMember[];
      marker: GroupMember | null;
      holes: PlayHole[];
      bag: PlayBagClub[];
      roundId: number | null;
    };

export async function getPlayState(tournamentId: number, userId: number): Promise<PlayState> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) return { status: "not_member" };

  const parts = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      slotId: tournamentParticipants.slotId,
      groupId: tournamentParticipants.groupId,
      markerId: tournamentParticipants.markerId,
      wantsDetail: tournamentParticipants.wantsDetail,
      signed: tournamentParticipants.signed,
      roundId: tournamentParticipants.roundId,
      joinedAt: tournamentParticipants.joinedAt,
      name: users.name,
    })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipants.joinedAt));

  const me = parts.find((p) => p.userId === userId);
  if (!me) return { status: "not_member" };
  if (!me.slotId) return { status: "no_slot" };

  const started = !t.startsAt || Date.now() >= t.startsAt.getTime();
  if (!started) {
    return {
      status: "not_started",
      startsAtLabel: t.startsAt
        ? t.startsAt.toLocaleString("es-ES", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    };
  }
  if (!me.groupId) return { status: "no_group" };

  const [grp] = await db
    .select()
    .from(tournamentGroups)
    .where(eq(tournamentGroups.id, me.groupId));
  const group = parts
    .filter((p) => p.groupId === me.groupId)
    .map((p) => ({ participantId: p.id, userId: p.userId, name: p.name ?? "Jugador" }));
  const teeTimeLabel = grp?.teeTime ?? null;
  const canEnter = true;

  const marker = me.markerId
    ? (group.find((g) => g.participantId === me.markerId) ?? null)
    : null;

  // Course pars + lengths
  let pars: { holeNumber: number; par: number; dist: number | null }[] = [];
  if (t.courseId) {
    const ch = await db
      .select({
        number: courseHolesTable.number,
        par: courseHolesTable.par,
        dist: courseHolesTable.distanceMeters,
      })
      .from(courseHolesTable)
      .where(eq(courseHolesTable.courseId, t.courseId))
      .orderBy(asc(courseHolesTable.number));
    pars = ch.map((h) => ({ holeNumber: h.number, par: h.par, dist: h.dist }));
  }
  if (pars.length === 0) {
    pars = Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, par: 4, dist: null }));
  }

  // The player's bag for the detail club selects.
  const bag = await db
    .select({ id: clubs.id, name: clubs.name, kind: clubs.kind })
    .from(clubs)
    .where(eq(clubs.userId, userId))
    .orderBy(asc(clubs.position));

  // Scores
  const ids = [me.id, ...(me.markerId ? [me.markerId] : [])];
  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(
      and(
        eq(tournamentHoleScores.tournamentId, tournamentId),
        inArray(tournamentHoleScores.participantId, ids),
      ),
    );
  const mineByHole = new Map(scores.filter((s) => s.participantId === me.id).map((s) => [s.holeNumber, s]));
  const markerByHole = new Map(
    scores.filter((s) => s.participantId === me.markerId).map((s) => [s.holeNumber, s]),
  );

  const holes: PlayHole[] = pars.map((p) => {
    const mine = mineByHole.get(p.holeNumber);
    const mk = markerByHole.get(p.holeNumber);
    return {
      holeNumber: p.holeNumber,
      par: p.par,
      selfStrokes: mine?.selfStrokes ?? null,
      selfPutts: mine?.selfPutts ?? null,
      markerStrokes: mine?.markerStrokes ?? null,
      markStrokes: mk?.markerStrokes ?? null,
      markerSelfStrokes: mk?.selfStrokes ?? null,
      fairway: (mine?.fairway as FairwayValue) ?? null,
      teeClub: mine?.teeClub ?? null,
      teeDistanceMeters: mine?.teeDistanceMeters ?? null,
      approachClub: mine?.approachClub ?? null,
      approachDistanceMeters: mine?.approachDistanceMeters ?? null,
      approachResult: (mine?.approachResult as FairwayValue) ?? null,
      sand: mine?.sand ?? null,
      firstPuttDistanceMeters: mine?.firstPuttDistanceMeters ?? null,
      puttResult: (mine?.puttResult as FairwayValue) ?? null,
      penalties: mine?.penalties ?? null,
      holeDistanceMeters: p.dist,
    };
  });

  return {
    status: "ok",
    tournamentId,
    participantId: me.id,
    wantsDetail: me.wantsDetail,
    signed: me.signed,
    canEnter,
    teeTimeLabel,
    group,
    marker,
    holes,
    bag,
    roundId: me.roundId ?? null,
  };
}

export type ScoringFormat = "stroke" | "stroke_net" | "stableford" | "stableford_net";

export interface LeaderboardRow {
  participantId: number;
  userId: number;
  name: string;
  signed: boolean;
  holesPlayed: number;
  strokes: number | null; // golpes brutos
  toPar: number | null; // bruto al par
  netToPar: number | null; // neto al par
  points: number | null; // puntos stableford (según formato)
}

export interface Leaderboard {
  format: ScoringFormat;
  rows: LeaderboardRow[];
}

/**
 * Hándicap de campo (WHS): índice × (slope / 113) + (course rating − par).
 * Sin slope/rating cae al índice redondeado.
 */
function courseHandicap(
  hi: number | null,
  slope: number | null,
  cr: number | null,
  par: number | null,
): number | null {
  if (hi == null) return null;
  const s = slope ?? 113;
  const adj = cr != null && par != null ? cr - par : 0;
  return Math.round(hi * (s / 113) + adj);
}

/** Golpes recibidos en un hoyo según hándicap de juego e índice (SI). */
function strokesReceived(playingHcp: number | null, si: number | null): number {
  if (playingHcp == null || si == null) return 0;
  const p = Math.round(playingHcp);
  if (p === 0) return 0;
  const sign = p > 0 ? 1 : -1;
  const abs = Math.abs(p);
  const base = Math.floor(abs / 18);
  const extra = abs % 18;
  const gets = sign > 0 ? si <= extra : si > 18 - extra;
  return sign * (base + (gets ? 1 : 0));
}

/** Puntos Stableford de un hoyo: par=2, birdie=3, eagle=4… bogey=1, doble o peor=0. */
function stablefordPoints(strokes: number, par: number): number {
  return Math.max(0, 2 - (strokes - par));
}

export async function getTournamentLeaderboard(tournamentId: number): Promise<Leaderboard> {
  const [t] = await db
    .select({
      scoringFormat: tournaments.scoringFormat,
      courseId: tournaments.courseId,
      teeId: tournaments.teeId,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));
  const format: ScoringFormat = (t?.scoringFormat as ScoringFormat) ?? "stroke";

  // Slope / course rating of the played tee (for the course handicap).
  let slope: number | null = null;
  let courseRating: number | null = null;
  if (t?.teeId) {
    const [tee] = await db
      .select({ slope: courseTees.slopeRating, cr: courseTees.courseRating })
      .from(courseTees)
      .where(eq(courseTees.id, t.teeId));
    slope = tee?.slope ?? null;
    courseRating = tee?.cr ?? null;
  }

  const parts = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      signed: tournamentParticipants.signed,
      name: users.name,
      handicap: users.handicap,
    })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipants.joinedAt));
  if (parts.length === 0) return { format, rows: [] };

  // Stroke indexes + par per hole (for net formats and the course par).
  const siByHole = new Map<number, number | null>();
  let coursePar = 0;
  if (t?.courseId) {
    const ch = await db
      .select({
        number: courseHolesTable.number,
        si: courseHolesTable.strokeIndex,
        par: courseHolesTable.par,
      })
      .from(courseHolesTable)
      .where(eq(courseHolesTable.courseId, t.courseId));
    for (const h of ch) {
      siByHole.set(h.number, h.si);
      coursePar += h.par;
    }
  }

  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.tournamentId, tournamentId));

  const isNet = format === "stroke_net" || format === "stableford_net";
  const isStableford = format === "stableford" || format === "stableford_net";

  const rows: LeaderboardRow[] = parts.map((p) => {
    const s = scores.filter((x) => x.participantId === p.id && x.selfStrokes != null);
    const holesPlayed = s.length;
    // Course handicap from index + slope/CR (per the played tee).
    const playing = isNet ? courseHandicap(p.handicap, slope, courseRating, coursePar || null) : null;
    let gross = 0;
    let par = 0;
    let received = 0;
    let points = 0;
    for (const x of s) {
      const st = x.selfStrokes ?? 0;
      const hp = x.par ?? 0;
      gross += st;
      par += hp;
      const sr = isNet ? strokesReceived(playing, siByHole.get(x.holeNumber) ?? null) : 0;
      received += sr;
      if (isStableford) points += stablefordPoints(st - sr, hp);
    }
    return {
      participantId: p.id,
      userId: p.userId,
      name: p.name ?? "Jugador",
      signed: p.signed,
      holesPlayed,
      strokes: holesPlayed ? gross : null,
      toPar: holesPlayed ? gross - par : null,
      netToPar: holesPlayed ? gross - received - par : null,
      points: holesPlayed && isStableford ? points : null,
    };
  });

  rows.sort((a, b) => {
    if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
    if (a.holesPlayed === 0) return 1;
    if (b.holesPlayed === 0) return -1;
    if (isStableford) return (b.points ?? 0) - (a.points ?? 0); // más puntos primero
    const av = isNet ? (a.netToPar ?? 0) : (a.toPar ?? 0);
    const bv = isNet ? (b.netToPar ?? 0) : (b.toPar ?? 0);
    return av - bv; // menos golpes primero
  });

  return { format, rows };
}

export interface CardStatus {
  participantId: number;
  userId: number;
  name: string;
  signed: boolean;
  holesPlayed: number;
  allVerified: boolean;
  roundId: number | null;
}

/** Per-participant card status, for the organizer's "sign on behalf" panel. */
export async function getTournamentCardStatuses(tournamentId: number): Promise<CardStatus[]> {
  const [t] = await db
    .select({ courseId: tournaments.courseId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  let holeNumbers: number[] = [];
  if (t?.courseId) {
    const ch = await db
      .select({ number: courseHolesTable.number })
      .from(courseHolesTable)
      .where(eq(courseHolesTable.courseId, t.courseId))
      .orderBy(asc(courseHolesTable.number));
    holeNumbers = ch.map((h) => h.number);
  }
  if (holeNumbers.length === 0) holeNumbers = Array.from({ length: 18 }, (_, i) => i + 1);

  const parts = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      signed: tournamentParticipants.signed,
      roundId: tournamentParticipants.roundId,
      name: users.name,
    })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipants.joinedAt));

  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.tournamentId, tournamentId));

  return parts.map((p) => {
    const s = scores.filter((x) => x.participantId === p.id);
    const byHole = new Map(s.map((x) => [x.holeNumber, x]));
    const holesPlayed = s.filter((x) => x.selfStrokes != null).length;
    const allVerified = holeNumbers.every((n) => {
      const x = byHole.get(n);
      return (
        x != null &&
        x.selfStrokes != null &&
        x.markerStrokes != null &&
        x.selfStrokes === x.markerStrokes
      );
    });
    return {
      participantId: p.id,
      userId: p.userId,
      name: p.name ?? "Jugador",
      signed: p.signed,
      holesPlayed,
      allVerified,
      roundId: p.roundId ?? null,
    };
  });
}

export async function getCardData(tournamentId: number, participantId: number) {
  const [p] = await db
    .select({ id: tournamentParticipants.id, userId: tournamentParticipants.userId, signed: tournamentParticipants.signed, name: users.name })
    .from(tournamentParticipants)
    .leftJoin(users, eq(tournamentParticipants.userId, users.id))
    .where(
      and(
        eq(tournamentParticipants.id, participantId),
        eq(tournamentParticipants.tournamentId, tournamentId),
      ),
    );
  if (!p) return null;

  const scores = await db
    .select()
    .from(tournamentHoleScores)
    .where(eq(tournamentHoleScores.participantId, participantId))
    .orderBy(asc(tournamentHoleScores.holeNumber));

  const holes = scores.map((s) => ({
    holeNumber: s.holeNumber,
    par: s.par,
    strokes: s.selfStrokes,
    putts: s.selfPutts,
    verified:
      s.selfStrokes != null && s.markerStrokes != null && s.selfStrokes === s.markerStrokes,
    mismatch:
      s.selfStrokes != null && s.markerStrokes != null && s.selfStrokes !== s.markerStrokes,
  }));

  return { name: p.name ?? "Jugador", signed: p.signed, holes };
}
