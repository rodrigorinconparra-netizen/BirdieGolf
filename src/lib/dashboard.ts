import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { rounds, roundHoles, users } from "@/lib/db/schema";

interface RoundAgg {
  id: number;
  playedAt: Date;
  holesPlayed: number;
  strokes: number;
  parPlayed: number;
  toPar: number;
  putts: number;
  gir: number;
  fairwayHoles: number;
  fairwayHit: number;
  scrambleChances: number;
  scrambleSaves: number;
  penalties: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
}

export interface Metrics {
  avgStrokes: number;
  toPar: number;
  girPct: number;
  fairwayPct: number;
  puttsPerRound: number;
  scramblePct: number;
}

export interface Trend {
  delta: string | null;
  positive: boolean | null;
}

export interface DashboardData {
  roundsCount: number;
  handicap: number | null;
  overall: Metrics | null;
  trends: {
    toPar: Trend;
    girPct: Trend;
    fairwayPct: Trend;
    puttsPerRound: Trend;
    scramblePct: Trend;
  } | null;
  evolution: { id: number; date: string; toPar: number; strokes: number }[];
  distribution: { birdies: number; pars: number; bogeys: number; doubles: number; holes: number };
  weakest: { label: string; hint: string } | null;
}

function metricsOf(aggs: RoundAgg[]): Metrics | null {
  if (aggs.length === 0) return null;
  const holesPlayed = aggs.reduce((s, a) => s + a.holesPlayed, 0) || 1;
  const fairwayHoles = aggs.reduce((s, a) => s + a.fairwayHoles, 0) || 1;
  const scrambleChances = aggs.reduce((s, a) => s + a.scrambleChances, 0);
  return {
    avgStrokes: aggs.reduce((s, a) => s + a.strokes, 0) / aggs.length,
    toPar: aggs.reduce((s, a) => s + a.toPar, 0) / aggs.length,
    girPct: (aggs.reduce((s, a) => s + a.gir, 0) / holesPlayed) * 100,
    fairwayPct: (aggs.reduce((s, a) => s + a.fairwayHit, 0) / fairwayHoles) * 100,
    puttsPerRound: aggs.reduce((s, a) => s + a.putts, 0) / aggs.length,
    scramblePct: scrambleChances
      ? (aggs.reduce((s, a) => s + a.scrambleSaves, 0) / scrambleChances) * 100
      : 0,
  };
}

function trend(
  recent: number,
  previous: number | undefined,
  lowerIsBetter: boolean,
  fmt: (n: number) => string,
): Trend {
  if (previous === undefined) return { delta: null, positive: null };
  const d = recent - previous;
  if (Math.abs(d) < 0.05) return { delta: "igual", positive: null };
  const positive = lowerIsBetter ? d < 0 : d > 0;
  return { delta: `${d > 0 ? "+" : ""}${fmt(d)}`, positive };
}

function pickWeakest(m: Metrics): { label: string; hint: string } | null {
  const issues: { label: string; hint: string; severity: number }[] = [];
  if (m.puttsPerRound >= 33)
    issues.push({ label: "Putting", hint: "demasiados putts por vuelta", severity: m.puttsPerRound - 30 });
  if (m.girPct < 40)
    issues.push({ label: "Golpe a green", hint: "pocos greens en regulación", severity: 40 - m.girPct });
  if (m.fairwayPct < 55)
    issues.push({ label: "Salida", hint: "pocas calles cogidas", severity: 55 - m.fairwayPct });
  if (m.scramblePct < 40)
    issues.push({ label: "Juego corto", hint: "pocos up & down", severity: 40 - m.scramblePct });
  if (issues.length === 0) return null;
  issues.sort((a, b) => b.severity - a.severity);
  return { label: issues[0].label, hint: issues[0].hint };
}

export async function getDashboardData(userId: number): Promise<DashboardData> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const handicap = user?.handicap ?? null;

  const rs = await db
    .select()
    .from(rounds)
    .where(eq(rounds.userId, userId))
    .orderBy(asc(rounds.playedAt));

  return buildDashboard(handicap, rs);
}

/** Dashboard computed only from a given set of rounds (e.g. those played inside a league/tournament). */
export async function getDashboardDataForRounds(
  userId: number,
  roundIds: number[],
): Promise<DashboardData> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const handicap = user?.handicap ?? null;

  if (roundIds.length === 0) return emptyDashboard(handicap);

  const rs = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.userId, userId), inArray(rounds.id, roundIds)))
    .orderBy(asc(rounds.playedAt));

  return buildDashboard(handicap, rs);
}

function emptyDashboard(handicap: number | null): DashboardData {
  return {
    roundsCount: 0,
    handicap,
    overall: null,
    trends: null,
    evolution: [],
    distribution: { birdies: 0, pars: 0, bogeys: 0, doubles: 0, holes: 0 },
    weakest: null,
  };
}

async function buildDashboard(
  handicap: number | null,
  rs: (typeof rounds.$inferSelect)[],
): Promise<DashboardData> {
  const empty: DashboardData = {
    roundsCount: 0,
    handicap,
    overall: null,
    trends: null,
    evolution: [],
    distribution: { birdies: 0, pars: 0, bogeys: 0, doubles: 0, holes: 0 },
    weakest: null,
  };
  if (rs.length === 0) return empty;

  const allHoles = await db
    .select()
    .from(roundHoles)
    .where(inArray(roundHoles.roundId, rs.map((r) => r.id)));

  const byRound = new Map<number, typeof allHoles>();
  for (const h of allHoles) {
    const list = byRound.get(h.roundId) ?? [];
    list.push(h);
    byRound.set(h.roundId, list);
  }

  const aggs: RoundAgg[] = [];
  for (const r of rs) {
    const holes = (byRound.get(r.id) ?? []).filter((h) => h.strokes != null);
    if (holes.length === 0) continue;
    const a: RoundAgg = {
      id: r.id,
      playedAt: r.playedAt,
      holesPlayed: holes.length,
      strokes: 0,
      parPlayed: 0,
      toPar: 0,
      putts: 0,
      gir: 0,
      fairwayHoles: 0,
      fairwayHit: 0,
      scrambleChances: 0,
      scrambleSaves: 0,
      penalties: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubles: 0,
    };
    for (const h of holes) {
      const par = h.par ?? 4;
      const st = h.strokes ?? 0;
      a.strokes += st;
      a.parPlayed += par;
      a.putts += h.putts ?? 0;
      a.penalties += h.penalties ?? 0;
      if (h.greenInRegulation) a.gir += 1;
      if (par >= 4 && h.fairway) {
        a.fairwayHoles += 1;
        if (h.fairway === "hit") a.fairwayHit += 1;
      }
      if (h.greenInRegulation === false) {
        a.scrambleChances += 1;
        if (st - par <= 0) a.scrambleSaves += 1;
      }
      const rel = st - par;
      if (rel <= -1) a.birdies += 1;
      else if (rel === 0) a.pars += 1;
      else if (rel === 1) a.bogeys += 1;
      else a.doubles += 1;
    }
    a.toPar = a.strokes - a.parPlayed;
    aggs.push(a);
  }

  if (aggs.length === 0) return { ...empty, roundsCount: rs.length };

  const overall = metricsOf(aggs)!;

  // Trends: split into recent half vs previous half
  const recentCount = Math.max(1, Math.floor(aggs.length / 2));
  const recent = metricsOf(aggs.slice(-recentCount));
  const previous = metricsOf(aggs.slice(0, aggs.length - recentCount));
  const pct = (n: number) => `${Math.abs(n).toFixed(0)} pts`;
  const num = (n: number) => Math.abs(n).toFixed(1);
  const trends =
    recent && previous
      ? {
          toPar: trend(recent.toPar, previous.toPar, true, num),
          girPct: trend(recent.girPct, previous.girPct, false, pct),
          fairwayPct: trend(recent.fairwayPct, previous.fairwayPct, false, pct),
          puttsPerRound: trend(recent.puttsPerRound, previous.puttsPerRound, true, num),
          scramblePct: trend(recent.scramblePct, previous.scramblePct, false, pct),
        }
      : null;

  const evolution = aggs.slice(-10).map((a) => ({
    id: a.id,
    date: new Date(a.playedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    toPar: a.toPar,
    strokes: a.strokes,
  }));

  const distribution = aggs.reduce(
    (d, a) => ({
      birdies: d.birdies + a.birdies,
      pars: d.pars + a.pars,
      bogeys: d.bogeys + a.bogeys,
      doubles: d.doubles + a.doubles,
      holes: d.holes + a.holesPlayed,
    }),
    { birdies: 0, pars: 0, bogeys: 0, doubles: 0, holes: 0 },
  );

  return {
    roundsCount: aggs.length,
    handicap,
    overall,
    trends,
    evolution,
    distribution,
    weakest: pickWeakest(overall),
  };
}
