import "server-only";

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

interface SummaryHole {
  holeNumber: number;
  par: number | null;
  strokes: number | null;
  putts: number | null;
  fairway: string | null;
  greenInRegulation: boolean | null;
  teeClub: string | null;
  approachClub: string | null;
  approachDistanceMeters: number | null;
  approachResult: string | null;
  sand: boolean | null;
  firstPuttDistanceMeters: number | null;
  puttResult: string | null;
  penalties: number | null;
}

const DIR: Record<string, string> = {
  hit: "en objetivo",
  left: "izquierda",
  right: "derecha",
  short: "corto",
  long: "largo",
};
const dir = (v: string | null) => (v ? (DIR[v] ?? v) : "?");

/** Builds a compact, data-rich text report of the round for the LLM. */
export function buildRoundSummary(courseName: string, holes: SummaryHole[]): string {
  const played = holes.filter((h) => h.strokes != null);
  const n = played.length || 1;
  const parPlayed = played.reduce((s, h) => s + (h.par ?? 0), 0);
  const strokes = played.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const putts = played.reduce((s, h) => s + (h.putts ?? 0), 0);
  const threePutts = played.filter((h) => (h.putts ?? 0) >= 3).length;
  const onePutts = played.filter((h) => (h.putts ?? 0) === 1).length;
  const gir = played.filter((h) => h.greenInRegulation).length;

  const fwHoles = played.filter((h) => (h.par ?? 4) >= 4);
  const fwHit = fwHoles.filter((h) => h.fairway === "hit").length;
  const fwLeft = fwHoles.filter((h) => h.fairway === "left").length;
  const fwRight = fwHoles.filter((h) => h.fairway === "right").length;

  const penalties = played.reduce((s, h) => s + (h.penalties ?? 0), 0);
  const bunkers = played.filter((h) => h.sand).length;

  const rel = (h: SummaryHole) => (h.strokes ?? 0) - (h.par ?? 0);
  const birdies = played.filter((h) => rel(h) <= -1).length;
  const pars = played.filter((h) => rel(h) === 0).length;
  const bogeys = played.filter((h) => rel(h) === 1).length;
  const doubles = played.filter((h) => rel(h) >= 2).length;

  const apprMiss = played.filter((h) => h.approachResult && h.approachResult !== "hit");
  const apprShort = apprMiss.filter((h) => h.approachResult === "short").length;
  const puttMiss = played.filter((h) => h.puttResult && h.puttResult !== "hit");
  const puttShort = puttMiss.filter((h) => h.puttResult === "short").length;

  const lines: string[] = [
    `Campo: ${courseName}`,
    `Hoyos jugados: ${n} | Par jugado: ${parPlayed}`,
    `Golpes: ${strokes} (${strokes - parPlayed >= 0 ? "+" : ""}${strokes - parPlayed} al par)`,
    `Putts: ${putts} (${(putts / n).toFixed(1)}/hoyo) | 3-putts: ${threePutts} | 1-putts: ${onePutts}`,
    `Greens en regulación: ${gir}/${n}`,
    `Calles cogidas: ${fwHit}/${fwHoles.length} (fallos: ${fwLeft} izquierda, ${fwRight} derecha)`,
    `Aproximaciones falladas: ${apprMiss.length}, de ellas cortas: ${apprShort}`,
    `Primeros putts que se quedaron cortos: ${puttShort}/${puttMiss.length}`,
    `Penalidades: ${penalties} | Hoyos con bunker: ${bunkers}`,
    `Tarjeta: birdies o mejor ${birdies}, pares ${pars}, bogeys ${bogeys}, dobles o peor ${doubles}`,
    "",
    "Detalle hoyo a hoyo:",
  ];

  for (const h of holes) {
    if (h.strokes == null) continue;
    const p: string[] = [`Hoyo ${h.holeNumber} (par ${h.par})`, `${h.strokes} golpes`, `${h.putts ?? "?"} putts`];
    if ((h.par ?? 4) >= 4) p.push(`salida ${h.teeClub ?? "?"}, calle ${dir(h.fairway)}`);
    p.push(`golpe a green ${h.approachClub ?? "?"} desde ${h.approachDistanceMeters ?? "?"}m -> ${dir(h.approachResult)}`);
    p.push(`putt de ${h.firstPuttDistanceMeters ?? "?"}m -> ${dir(h.puttResult)}`);
    if (h.sand) p.push("bunker");
    if ((h.penalties ?? 0) > 0) p.push(`${h.penalties} penalidad`);
    p.push(h.greenInRegulation ? "GIR sí" : "GIR no");
    lines.push("- " + p.join(", "));
  }

  return lines.join("\n");
}
