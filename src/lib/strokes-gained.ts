import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  rounds,
  roundHoles,
  holes as courseHoles,
  teeHoleDistances,
  users,
} from "@/lib/db/schema";

/**
 * Strokes Gained (estimación).
 *
 * Compara cada golpe con una tabla de "golpes esperados para embocar" desde una
 * distancia y lie de referencia (nivel bajo de hándicap). Por hoyo, cuando hay
 * datos suficientes, se reparte en tres categorías que suman el total del hoyo:
 *   Salida (off the tee) + Juego a green (approach + corto) + Putt = Total.
 *
 * Datos usados (de round_holes): par, golpes, putts, calle (lie tras la salida),
 * distancia a bandera del approach (lo que queda tras la salida) y distancia del
 * primer putt. Es una estimación: no captura golpe a golpe completo.
 */

type Point = [meters: number, expected: number];

/** Interpolación lineal sobre una tabla ordenada, con extremos planos. */
function interp(table: Point[], m: number): number {
  if (m <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (m >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (m <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (m - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

// Golpes esperados para embocar (referencia ~scratch), en metros.
const PUTT: Point[] = [
  [0.3, 1.001], [0.6, 1.04], [1, 1.1], [1.5, 1.31], [2, 1.5], [2.5, 1.61],
  [3, 1.69], [4, 1.79], [5, 1.86], [6, 1.92], [8, 2.0], [10, 2.06],
  [12, 2.12], [15, 2.2], [20, 2.32], [25, 2.42], [30, 2.5],
];

const FAIRWAY: Point[] = [
  [10, 2.18], [20, 2.4], [30, 2.52], [40, 2.6], [50, 2.66], [60, 2.7],
  [75, 2.75], [90, 2.8], [110, 2.85], [128, 2.91], [146, 2.98], [165, 3.06],
  [183, 3.14], [200, 3.2], [220, 3.27],
];

const TEE: Point[] = [
  [100, 2.85], [130, 2.95], [150, 3.02], [165, 3.08], [180, 3.2], [200, 3.45],
  [230, 3.7], [260, 3.85], [290, 3.93], [320, 4.0], [350, 4.06], [380, 4.12],
  [410, 4.22], [440, 4.38], [470, 4.55], [500, 4.68], [540, 4.85],
];

function expPutt(m: number): number {
  return interp(PUTT, m);
}
function expFromTee(m: number): number {
  return interp(TEE, m);
}
/** Golpes esperados de un approach desde `m` metros según el lie. */
function expApproach(m: number, lie: "fairway" | "rough" | "sand"): number {
  const base = interp(FAIRWAY, m);
  if (lie === "rough") return base + 0.18;
  if (lie === "sand") return base + 0.4;
  return base;
}

/** Golpes esperados por defecto para un hoyo de un par dado (si no hay distancia). */
function expFromPar(par: number): number {
  if (par <= 3) return 3.05;
  if (par === 4) return 4.1;
  return 4.6;
}

export interface SgHole {
  holeNumber: number;
  par: number | null;
  strokes: number | null;
  putts: number | null;
  fairway: string | null; // "hit" = calle; otro = rough/fallo
  teeDistanceMeters: number | null; // distancia del drive (para situar el resultado de la salida)
  approachDistanceMeters: number | null; // distancia a bandera del approach (resto tras la salida)
  firstPuttDistanceMeters: number | null;
}

export interface StrokesGained {
  tee: number; // Salida (off the tee)
  approach: number; // Juego a green (approach + corto)
  putting: number; // Putt
  total: number; // SG total
  /** hoyos con datos completos para el desglose Salida/Juego/Putt */
  detailHoles: number;
  /** hoyos contados en el total (con golpes y distancia de hoyo) */
  totalHoles: number;
  /** true = calibrado al hándicap del jugador; false = vs scratch */
  net: boolean;
}

const EMPTY: StrokesGained = {
  tee: 0,
  approach: 0,
  putting: 0,
  total: 0,
  detailHoles: 0,
  totalHoles: 0,
  net: false,
};

// Reparto típico de pérdida de golpes de un amateur vs scratch (Broadie):
// la mayoría en el juego largo, menos en el putt. Se usa para calibrar al hándicap.
const HCP_SPLIT = { tee: 0.28, middle: 0.55, putt: 0.17 };

/**
 * Strokes Gained de una vuelta.
 * `holeDistances` = longitud del hoyo por número.
 * `handicap` = hándicap del jugador; si se da, el SG se calibra a SU nivel (neto).
 *
 * La SALIDA se atribuye según DÓNDE dejó el drive (su distancia + si cogió calle o
 * rough), no según la distancia del approach a green. Así, un drive corto o a rough
 * (o "bajo un árbol") penaliza la Salida, y no el golpe a green.
 */
export function computeStrokesGained(
  holes: SgHole[],
  holeDistances: Record<number, number | null>,
  handicap: number | null = null,
): StrokesGained {
  const sg = { ...EMPTY };
  for (const h of holes) {
    if (h.par == null || h.strokes == null) continue;
    const len = holeDistances[h.holeNumber] ?? null;
    const expStart = len != null ? expFromTee(len) : expFromPar(h.par);

    sg.total += expStart - h.strokes;
    sg.totalHoles += 1;

    // Desglose: requiere putts + distancia del 1er putt (+ calle/distancia en par>3).
    const d1 = h.firstPuttDistanceMeters;
    const isPar3 = h.par <= 3;
    if (h.putts == null || h.putts <= 0 || d1 == null) continue;

    const middleStrokes = h.strokes - h.putts - (isPar3 ? 0 : 1);
    if (middleStrokes < 0) continue; // datos incoherentes

    const ePutt = expPutt(d1);
    let teeSG = 0;
    let afterDrive = expStart;
    if (!isPar3) {
      if (h.fairway == null) continue; // sin saber calle/rough no separamos salida
      const lie = h.fairway === "hit" ? "fairway" : "rough";
      // Dónde quedó el drive: preferimos su propia distancia; si no, el resto al approach.
      const driveRemaining =
        len != null && h.teeDistanceMeters != null && len - h.teeDistanceMeters > 0
          ? len - h.teeDistanceMeters
          : h.approachDistanceMeters;
      if (driveRemaining == null) continue;
      afterDrive = expApproach(driveRemaining, lie);
      teeSG = expStart - afterDrive - 1;
    }
    const middleSG = afterDrive - ePutt - middleStrokes;
    const puttSG = ePutt - h.putts;

    sg.tee += teeSG;
    sg.approach += middleSG;
    sg.putting += puttSG;
    sg.detailHoles += 1;
  }

  // Calibración al hándicap: el jugador "se espera" que esté ~hándicap golpes sobre
  // scratch, repartidos según HCP_SPLIT. Así el SG queda relativo a SU nivel (si
  // juega a su hándicap ≈ 0; mejor = positivo).
  if (handicap != null && Number.isFinite(handicap)) {
    sg.net = true;
    const perHole = handicap / 18;
    sg.total += perHole * sg.totalHoles;
    const hcpDetail = perHole * sg.detailHoles;
    sg.tee += HCP_SPLIT.tee * hcpDetail;
    sg.approach += HCP_SPLIT.middle * hcpDetail;
    sg.putting += HCP_SPLIT.putt * hcpDetail;
  }
  return sg;
}

/** SG medio por vuelta de un jugador, sobre todas sus vueltas. */
export async function getStrokesGainedAverage(userId: number): Promise<StrokesGained> {
  const [u] = await db.select({ handicap: users.handicap }).from(users).where(eq(users.id, userId));
  const handicap = u?.handicap ?? null;

  const rs = await db
    .select({ id: rounds.id, courseId: rounds.courseId, teeId: rounds.teeId })
    .from(rounds)
    .where(eq(rounds.userId, userId));
  if (rs.length === 0) return { ...EMPTY };

  const roundIds = rs.map((r) => r.id);
  const rhs = await db.select().from(roundHoles).where(inArray(roundHoles.roundId, roundIds));

  const courseIds = [...new Set(rs.map((r) => r.courseId).filter((x): x is number => x != null))];
  const teeIds = [...new Set(rs.map((r) => r.teeId).filter((x): x is number => x != null))];

  const courseDist = courseIds.length
    ? await db
        .select({ courseId: courseHoles.courseId, number: courseHoles.number, dist: courseHoles.distanceMeters })
        .from(courseHoles)
        .where(inArray(courseHoles.courseId, courseIds))
    : [];
  const teeDist = teeIds.length
    ? await db
        .select({ teeId: teeHoleDistances.teeId, holeNumber: teeHoleDistances.holeNumber, meters: teeHoleDistances.meters })
        .from(teeHoleDistances)
        .where(inArray(teeHoleDistances.teeId, teeIds))
    : [];

  const perRound: StrokesGained[] = [];
  for (const r of rs) {
    const dists: Record<number, number | null> = {};
    if (r.courseId != null) {
      for (const d of courseDist) if (d.courseId === r.courseId) dists[d.number] = d.dist;
    }
    if (r.teeId != null) {
      for (const d of teeDist) if (d.teeId === r.teeId && d.meters != null) dists[d.holeNumber] = d.meters;
    }
    const holes = rhs
      .filter((h) => h.roundId === r.id)
      .map((h) => ({
        holeNumber: h.holeNumber,
        par: h.par,
        strokes: h.strokes,
        putts: h.putts,
        fairway: h.fairway,
        teeDistanceMeters: h.teeDistanceMeters,
        approachDistanceMeters: h.approachDistanceMeters,
        firstPuttDistanceMeters: h.firstPuttDistanceMeters,
      }));
    perRound.push(computeStrokesGained(holes, dists, handicap));
  }
  return averageStrokesGained(perRound);
}

/** Suma/promedia varias vueltas → SG medio por vuelta. */
export function averageStrokesGained(rounds: StrokesGained[]): StrokesGained {
  const withData = rounds.filter((r) => r.totalHoles > 0);
  if (withData.length === 0) return { ...EMPTY };
  const n = withData.length;
  const sum = withData.reduce(
    (a, r) => ({
      tee: a.tee + r.tee,
      approach: a.approach + r.approach,
      putting: a.putting + r.putting,
      total: a.total + r.total,
      detailHoles: a.detailHoles + r.detailHoles,
      totalHoles: a.totalHoles + r.totalHoles,
      net: a.net || r.net,
    }),
    { ...EMPTY },
  );
  return {
    tee: sum.tee / n,
    approach: sum.approach / n,
    putting: sum.putting / n,
    total: sum.total / n,
    detailHoles: sum.detailHoles,
    totalHoles: sum.totalHoles,
    net: withData.some((r) => r.net),
  };
}
