import "server-only";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { rounds, roundHoles, clubs } from "@/lib/db/schema";

export interface ClubDispersion {
  center: number;
  left: number;
  right: number;
  short: number;
  long: number;
}

export interface ClubStat {
  name: string;
  kind: string;
  uses: number;
  avgDistance: number | null;
  dispersion: ClubDispersion;
}

export interface PuttBucket {
  label: string;
  attempts: number;
  madePct: number;
  threePuttPct: number;
}

export interface PuttingStats {
  firstPutts: number;
  avgFirstPuttDistance: number | null;
  onePutts: number;
  threePutts: number;
  totalPutts: number;
  shortMade: number;
  shortAttempts: number;
  shortPct: number | null;
  buckets: PuttBucket[];
}

export interface PlayerStats {
  hasData: boolean;
  perClub: ClubStat[];
  putting: PuttingStats;
}

const DIR_KEY: Record<string, keyof ClubDispersion> = {
  hit: "center",
  left: "left",
  right: "right",
  short: "short",
  long: "long",
};

export async function getPlayerStats(userId: number): Promise<PlayerStats> {
  const emptyPutting: PuttingStats = {
    firstPutts: 0,
    avgFirstPuttDistance: null,
    onePutts: 0,
    threePutts: 0,
    totalPutts: 0,
    shortMade: 0,
    shortAttempts: 0,
    shortPct: null,
    buckets: [],
  };

  const rs = await db.select({ id: rounds.id }).from(rounds).where(eq(rounds.userId, userId));
  if (rs.length === 0) return { hasData: false, perClub: [], putting: emptyPutting };

  const bag = await db
    .select()
    .from(clubs)
    .where(eq(clubs.userId, userId))
    .orderBy(asc(clubs.position));
  const holes = await db
    .select()
    .from(roundHoles)
    .where(inArray(roundHoles.roundId, rs.map((r) => r.id)));

  // ---- Per club ----
  type Acc = { uses: number; distSum: number; distN: number; disp: ClubDispersion };
  const map = new Map<string, Acc>();
  const ensure = (name: string): Acc => {
    let e = map.get(name);
    if (!e) {
      e = { uses: 0, distSum: 0, distN: 0, disp: { center: 0, left: 0, right: 0, short: 0, long: 0 } };
      map.set(name, e);
    }
    return e;
  };

  for (const h of holes) {
    if (h.teeClub) {
      const e = ensure(h.teeClub);
      e.uses++;
      if (h.teeDistanceMeters != null) {
        e.distSum += h.teeDistanceMeters;
        e.distN++;
      }
      if (h.fairway && DIR_KEY[h.fairway]) e.disp[DIR_KEY[h.fairway]]++;
    }
    if (h.approachClub) {
      const e = ensure(h.approachClub);
      e.uses++;
      if (h.approachDistanceMeters != null) {
        e.distSum += h.approachDistanceMeters;
        e.distN++;
      }
      if (h.approachResult && DIR_KEY[h.approachResult]) e.disp[DIR_KEY[h.approachResult]]++;
    }
  }

  const perClub: ClubStat[] = [];
  const seen = new Set<string>();
  for (const c of bag) {
    if (c.kind === "putter") continue;
    seen.add(c.name);
    const e = map.get(c.name);
    if (!e || e.uses === 0) continue;
    perClub.push({
      name: c.name,
      kind: c.kind,
      uses: e.uses,
      avgDistance: e.distN ? Math.round(e.distSum / e.distN) : null,
      dispersion: e.disp,
    });
  }
  for (const [name, e] of map) {
    if (seen.has(name)) continue;
    perClub.push({
      name,
      kind: "other",
      uses: e.uses,
      avgDistance: e.distN ? Math.round(e.distSum / e.distN) : null,
      dispersion: e.disp,
    });
  }

  // ---- Putting ----
  const bucketDefs = [
    { label: "Menos de 2 m", min: 0, max: 2 },
    { label: "2 – 4 m", min: 2, max: 4 },
    { label: "4 – 8 m", min: 4, max: 8 },
    { label: "Más de 8 m", min: 8, max: Infinity },
  ];
  const buckets = bucketDefs.map((b) => ({ ...b, attempts: 0, made: 0, threePutt: 0 }));

  let firstPutts = 0;
  let distSum = 0;
  let distN = 0;
  let onePutts = 0;
  let threePutts = 0;
  let totalPutts = 0;
  let shortAttempts = 0;
  let shortMade = 0;

  for (const h of holes) {
    const p = h.putts;
    if (p == null) continue;
    totalPutts += p;
    if (p <= 0) continue;
    firstPutts++;
    if (p === 1) onePutts++;
    if (p >= 3) threePutts++;

    const d = h.firstPuttDistanceMeters;
    if (d != null) {
      distSum += d;
      distN++;
      const b = buckets.find((b) => d >= b.min && d < b.max);
      if (b) {
        b.attempts++;
        if (p === 1) b.made++;
        if (p >= 3) b.threePutt++;
      }
      if (d < 2) {
        shortAttempts++;
        if (p === 1) shortMade++;
      }
    }
    // The second putt always counts as a putt of <2 m: made if 2-putt, missed if 3+.
    if (p >= 2) {
      shortAttempts++;
      if (p === 2) shortMade++;
    }
  }

  const putting: PuttingStats = {
    firstPutts,
    avgFirstPuttDistance: distN ? Math.round((distSum / distN) * 10) / 10 : null,
    onePutts,
    threePutts,
    totalPutts,
    shortMade,
    shortAttempts,
    shortPct: shortAttempts ? Math.round((shortMade / shortAttempts) * 100) : null,
    buckets: buckets.map((b) => ({
      label: b.label,
      attempts: b.attempts,
      madePct: b.attempts ? Math.round((b.made / b.attempts) * 100) : 0,
      threePuttPct: b.attempts ? Math.round((b.threePutt / b.attempts) * 100) : 0,
    })),
  };

  return { hasData: holes.some((h) => h.strokes != null), perClub, putting };
}
