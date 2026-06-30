import { TrendingUp, Flag, Target, CircleDot, Sigma } from "lucide-react";
import type { StrokesGained } from "@/lib/strokes-gained";

/** Format a strokes-gained value: "+1.2", "−0.8", "0.0". */
function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return "0.0";
  return r > 0 ? `+${r.toFixed(1)}` : `−${Math.abs(r).toFixed(1)}`;
}

function tone(v: number): string {
  const r = Math.round(v * 10) / 10;
  if (r > 0.05) return "text-positive";
  if (r < -0.05) return "text-negative";
  return "text-ink-soft";
}

function Tile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Flag;
}) {
  return (
    <div className="rounded-2xl bg-white/60 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-faint" />
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone(value)}`}>{fmt(value)}</p>
      <p className="text-[11px] text-faint">{label}</p>
    </div>
  );
}

export function StrokesGainedCard({
  sg,
  title = "Strokes Gained",
  subtitle,
}: {
  sg: StrokesGained;
  title?: string;
  subtitle?: string;
}) {
  if (sg.totalHoles === 0) {
    return (
      <div className="glass p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-5 w-5 text-accent" /> {title}
        </h3>
        <p className="mt-2 text-sm text-muted">
          Necesitas vueltas con golpes y distancias registradas para calcular el Strokes Gained.
        </p>
      </div>
    );
  }

  const hasDetail = sg.detailHoles > 0;

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-5 w-5 text-accent" /> {title}
        </h3>
        <span className={`text-2xl font-semibold tabular-nums ${tone(sg.total)}`}>
          {fmt(sg.total)}
        </span>
      </div>
      <p className="text-xs text-muted">
        {subtitle ??
          (sg.net
            ? "Frente a tu nivel de hándicap (estimación). 0 ≈ jugaste a tu hándicap."
            : "Frente a un nivel de referencia scratch (estimación).")}
      </p>

      {hasDetail ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Tile label="Salida" value={sg.tee} icon={Flag} />
            <Tile label="Juego a green" value={sg.approach} icon={Target} />
            <Tile label="Putt" value={sg.putting} icon={CircleDot} />
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-faint">
            <Sigma className="h-3 w-3" /> Desglose sobre {sg.detailHoles} hoyo(s) con datos
            completos. Verde = ganas golpes; rojo = los pierdes.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-faint">
          Añade la distancia a bandera del approach y la del primer putt para ver el desglose por
          Salida / Juego a green / Putt.
        </p>
      )}
    </div>
  );
}
