import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScorecardHole {
  holeNumber: number;
  par: number | null;
  strokes: number | null;
  putts: number | null;
  fairway: string | null;
  approachResult: string | null;
  puttResult: string | null;
}

const ARROW: Record<string, string> = {
  left: "←",
  right: "→",
  short: "↓",
  long: "↑",
};

function dirCell(v: string | null, hitChar: string): ReactNode {
  if (!v) return <span className="text-faint">·</span>;
  if (v === "hit") return <span className="font-semibold text-positive">{hitChar}</span>;
  return <span className="text-ink-soft">{ARROW[v] ?? "·"}</span>;
}

function ScoreCell({ strokes, par }: { strokes: number | null; par: number | null }) {
  if (strokes == null) return <span className="text-faint">–</span>;
  const rel = par != null ? strokes - par : 0;
  const shape = rel <= -1 ? "rounded-full border" : rel >= 1 ? "border" : "";
  const tone =
    rel <= -1
      ? "border-positive text-positive"
      : rel === 1
        ? "border-warning text-[#9a6500]"
        : rel >= 2
          ? "border-negative text-negative"
          : "text-ink";
  return (
    <span
      className={cn(
        "inline-grid h-6 w-6 place-items-center text-sm font-semibold tabular-nums",
        shape,
        tone,
      )}
    >
      {strokes}
    </span>
  );
}

function sum(holes: ScorecardHole[], pick: (h: ScorecardHole) => number | null): number {
  return holes.reduce((s, h) => s + (pick(h) ?? 0), 0);
}

function Row({
  label,
  front,
  out,
  back,
  inSum,
  tot,
  render,
}: {
  label: string;
  front: ScorecardHole[];
  back: ScorecardHole[];
  out: ReactNode;
  inSum: ReactNode;
  tot: ReactNode;
  render: (h: ScorecardHole) => ReactNode;
}) {
  return (
    <tr className="border-t border-black/5">
      <th className="sticky left-0 z-10 bg-cream px-3 py-1.5 text-left text-xs font-medium text-muted">
        {label}
      </th>
      {front.map((h) => (
        <td key={h.holeNumber} className="px-1 py-1.5 text-center">
          {render(h)}
        </td>
      ))}
      <td className="bg-black/[0.04] px-1.5 py-1.5 text-center text-sm font-semibold">{out}</td>
      {back.map((h) => (
        <td key={h.holeNumber} className="px-1 py-1.5 text-center">
          {render(h)}
        </td>
      ))}
      <td className="bg-black/[0.04] px-1.5 py-1.5 text-center text-sm font-semibold">{inSum}</td>
      <td className="bg-accent/10 px-1.5 py-1.5 text-center text-sm font-bold text-accent-deep">
        {tot}
      </td>
    </tr>
  );
}

export function RoundScorecard({ holes }: { holes: ScorecardHole[] }) {
  const front = holes.filter((h) => h.holeNumber <= 9);
  const back = holes.filter((h) => h.holeNumber > 9);
  const played = holes.filter((h) => h.strokes != null);

  const totStrokes = sum(played, (h) => h.strokes);
  const parPlayed = sum(played, (h) => h.par);
  const totPutts = sum(holes, (h) => h.putts);
  const rel = totStrokes - parPlayed;
  const relLabel = totStrokes === 0 ? "—" : rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;

  const fairwayHoles = played.filter((h) => (h.par ?? 4) >= 4 && h.fairway);
  const fairwayHit = fairwayHoles.filter((h) => h.fairway === "hit").length;

  const head = (hs: ScorecardHole[]) =>
    hs.map((h) => (
      <th key={h.holeNumber} className="px-1 py-2 text-center text-xs font-semibold text-ink-soft">
        {h.holeNumber}
      </th>
    ));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Golpes" value={totStrokes || "—"} />
        <Stat label="Al par" value={relLabel} accent />
        <Stat label="Putts" value={totPutts || "—"} />
        <Stat label="Calles" value={`${fairwayHit}/${fairwayHoles.length}`} />
        <Stat
          label="Pares o mejor"
          value={`${played.filter((h) => (h.strokes ?? 99) - (h.par ?? 0) <= 0).length}/${played.length}`}
        />
      </div>

      <div className="glass overflow-x-auto p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black/[0.03]">
              <th className="sticky left-0 z-10 bg-cream px-3 py-2 text-left text-xs font-semibold text-muted">
                Hoyo
              </th>
              {head(front)}
              <th className="px-1.5 py-2 text-center text-xs font-semibold text-muted">OUT</th>
              {head(back)}
              <th className="px-1.5 py-2 text-center text-xs font-semibold text-muted">IN</th>
              <th className="px-1.5 py-2 text-center text-xs font-semibold text-accent-deep">TOT</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Par"
              front={front}
              back={back}
              out={sum(front, (h) => h.par)}
              inSum={sum(back, (h) => h.par)}
              tot={parPlayed}
              render={(h) => <span className="text-sm text-muted">{h.par ?? "·"}</span>}
            />
            <Row
              label="Golpes"
              front={front}
              back={back}
              out={sum(front, (h) => h.strokes) || "—"}
              inSum={sum(back, (h) => h.strokes) || "—"}
              tot={totStrokes || "—"}
              render={(h) => <ScoreCell strokes={h.strokes} par={h.par} />}
            />
            <Row
              label="Putts"
              front={front}
              back={back}
              out={sum(front, (h) => h.putts) || "—"}
              inSum={sum(back, (h) => h.putts) || "—"}
              tot={totPutts || "—"}
              render={(h) => (
                <span className="text-sm tabular-nums text-ink-soft">{h.putts ?? "·"}</span>
              )}
            />
            <Row
              label="Salida"
              front={front}
              back={back}
              out=""
              inSum=""
              tot=""
              render={(h) => ((h.par ?? 4) >= 4 ? dirCell(h.fairway, "●") : <span className="text-faint">·</span>)}
            />
            <Row
              label="A green"
              front={front}
              back={back}
              out=""
              inSum=""
              tot=""
              render={(h) => dirCell(h.approachResult, "●")}
            />
            <Row
              label="Putt"
              front={front}
              back={back}
              out=""
              inSum=""
              tot=""
              render={(h) => dirCell(h.puttResult, "✓")}
            />
          </tbody>
        </table>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
        <span><span className="text-positive">●</span> calle / green cogido · <span className="text-positive">✓</span> putt metido</span>
        <span>← → ↓ ↑ dirección del fallo</span>
        <span>○ birdie · □ bogey o peor</span>
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="glass p-3 text-center">
      <p className={cn("text-xl font-semibold", accent ? "text-accent" : "text-ink")}>{value}</p>
      <p className="text-[11px] text-faint">{label}</p>
    </div>
  );
}
