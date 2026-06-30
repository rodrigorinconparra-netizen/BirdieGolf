import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { rounds, roundHoles, trainings } from "@/lib/db/schema";
import type { TrainingCategory } from "@/lib/training-meta";

interface RoundMetrics {
  playedAt: Date;
  putts: number;
  fairwayPct: number | null;
  girPct: number | null;
  scramblePct: number | null;
  toPar: number;
}

type MetricKey = Exclude<keyof RoundMetrics, "playedAt">;

const METRIC: Record<
  TrainingCategory,
  { key: MetricKey; label: string; unit: string; lowerBetter: boolean }
> = {
  putting: { key: "putts", label: "Putts/vuelta", unit: "", lowerBetter: true },
  driving: { key: "fairwayPct", label: "Calles", unit: "%", lowerBetter: false },
  approach: { key: "girPct", label: "Greens en regulación", unit: "%", lowerBetter: false },
  short_game: { key: "scramblePct", label: "Up & Down", unit: "%", lowerBetter: false },
  mental: { key: "toPar", label: "Resultado al par", unit: "", lowerBetter: true },
  fitness: { key: "toPar", label: "Resultado al par", unit: "", lowerBetter: true },
  other: { key: "toPar", label: "Resultado al par", unit: "", lowerBetter: true },
};

export interface TrainingEval {
  trainingId: number;
  metricLabel: string;
  unit: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  status: "improved" | "worse" | "same" | "no_after" | "no_before" | "no_metric";
  beforeRounds: number;
  afterRounds: number;
}

function avg(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

export async function getTrainingEvaluations(
  userId: number,
): Promise<Map<number, TrainingEval>> {
  const result = new Map<number, TrainingEval>();

  const allTrainings = await db.select().from(trainings).where(eq(trainings.userId, userId));
  const done = allTrainings.filter((t) => t.completed && t.performedAt);
  if (done.length === 0) return result;

  const rs = await db
    .select({ id: rounds.id, playedAt: rounds.playedAt })
    .from(rounds)
    .where(eq(rounds.userId, userId))
    .orderBy(asc(rounds.playedAt));
  if (rs.length === 0) return result;

  const holes = await db
    .select()
    .from(roundHoles)
    .where(inArray(roundHoles.roundId, rs.map((r) => r.id)));
  const byRound = new Map<number, typeof holes>();
  for (const h of holes) {
    const l = byRound.get(h.roundId) ?? [];
    l.push(h);
    byRound.set(h.roundId, l);
  }

  const metrics: RoundMetrics[] = [];
  for (const r of rs) {
    const hs = (byRound.get(r.id) ?? []).filter((h) => h.strokes != null);
    if (hs.length === 0) continue;
    let strokes = 0;
    let parPlayed = 0;
    let putts = 0;
    let gir = 0;
    let fwH = 0;
    let fwHit = 0;
    let scrCh = 0;
    let scrSv = 0;
    for (const h of hs) {
      const par = h.par ?? 4;
      const st = h.strokes ?? 0;
      strokes += st;
      parPlayed += par;
      putts += h.putts ?? 0;
      if (h.greenInRegulation) gir++;
      if (par >= 4 && h.fairway) {
        fwH++;
        if (h.fairway === "hit") fwHit++;
      }
      if (h.greenInRegulation === false) {
        scrCh++;
        if (st - par <= 0) scrSv++;
      }
    }
    metrics.push({
      playedAt: r.playedAt,
      putts,
      fairwayPct: fwH ? (fwHit / fwH) * 100 : null,
      girPct: (gir / hs.length) * 100,
      scramblePct: scrCh ? (scrSv / scrCh) * 100 : null,
      toPar: strokes - parPlayed,
    });
  }

  for (const t of done) {
    const cat = (t.category as TrainingCategory) ?? "other";
    const def = METRIC[cat] ?? METRIC.other;
    const T = t.performedAt as Date;
    const before = metrics.filter((m) => m.playedAt < T);
    const after = metrics.filter((m) => m.playedAt >= T);
    const beforeAvg = avg(before.map((m) => m[def.key]));
    const afterAvg = avg(after.map((m) => m[def.key]));

    let status: TrainingEval["status"];
    let delta: number | null = null;
    if (after.length === 0) status = "no_after";
    else if (before.length === 0 || beforeAvg == null) status = "no_before";
    else if (afterAvg == null) status = "no_metric";
    else {
      delta = afterAvg - beforeAvg;
      const improved = def.lowerBetter ? delta < 0 : delta > 0;
      const threshold = def.unit === "%" ? 2 : 0.5;
      status = Math.abs(delta) < threshold ? "same" : improved ? "improved" : "worse";
    }

    result.set(t.id, {
      trainingId: t.id,
      metricLabel: def.label,
      unit: def.unit,
      before: beforeAvg,
      after: afterAvg,
      delta,
      status,
      beforeRounds: before.length,
      afterRounds: after.length,
    });
  }

  return result;
}
