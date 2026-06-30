import {
  Flag,
  Target,
  Crosshair,
  Goal,
  Activity,
  CircleDot,
  LineChart,
} from "lucide-react";
import type { DashboardData, Trend } from "@/lib/dashboard";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

function t(trend: Trend | undefined): { delta?: string; deltaPositive: boolean | null } {
  if (!trend || trend.delta == null) return { deltaPositive: null };
  return { delta: trend.delta, deltaPositive: trend.positive };
}

/** Reusable performance dashboard for a player, computed from a set of rounds. */
export function PlayerDashboard({ data }: { data: DashboardData }) {
  const m = data.overall;
  if (!m) {
    return (
      <div className="glass flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted">
        <Flag className="h-6 w-6 text-faint" />
        Aún no hay vueltas firmadas para mostrar métricas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-positive" /> Mejora
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-negative" /> Empeora
        </span>
        <span className="text-faint">· {data.roundsCount} vuelta(s)</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Hándicap"
          value={data.handicap != null ? data.handicap.toFixed(1) : "—"}
          icon={Activity}
        />
        <StatCard
          label="Scoring medio"
          value={m.avgStrokes.toFixed(0)}
          icon={Flag}
          {...t(data.trends?.toPar)}
        />
        <StatCard
          label="Greens en regulación"
          value={m.girPct.toFixed(0)}
          unit="%"
          icon={Target}
          {...t(data.trends?.girPct)}
        />
        <StatCard
          label="Calles cogidas"
          value={m.fairwayPct.toFixed(0)}
          unit="%"
          icon={Crosshair}
          {...t(data.trends?.fairwayPct)}
        />
        <StatCard
          label="Putts / vuelta"
          value={m.puttsPerRound.toFixed(1)}
          icon={CircleDot}
          {...t(data.trends?.puttsPerRound)}
        />
        <StatCard
          label="Up & Down"
          value={m.scramblePct.toFixed(0)}
          unit="%"
          icon={Goal}
          {...t(data.trends?.scramblePct)}
        />
      </div>

      <div className="glass p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Evolución del scoring</h3>
          <Badge tone="neutral">al par por vuelta</Badge>
        </div>
        <ScoringChart evolution={data.evolution} />
      </div>

      <Distribution dist={data.distribution} />
    </div>
  );
}

/** Format a to-par value: "E" at par, "+n" over, "-n" under. */
function fmtToPar(v: number): string {
  return v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`;
}

/** Bar colour by how the round went relative to par. */
function scoreColor(toPar: number): string {
  if (toPar <= 0) return "bg-positive";
  if (toPar <= 6) return "bg-accent";
  if (toPar <= 14) return "bg-warning";
  return "bg-negative";
}

function ScoringChart({
  evolution,
}: {
  evolution: { id: number; date: string; toPar: number; strokes: number }[];
}) {
  if (evolution.length === 0) {
    return (
      <div className="mt-6 flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-sm text-faint">
        <LineChart className="h-6 w-6" />
        Sin vueltas para mostrar evolución.
      </div>
    );
  }
  // Normalise over the real min..max so under-par rounds (negative) render correctly
  // and differences are visible. Lower (better) → shorter bar; higher → taller.
  const vals = evolution.map((e) => e.toPar);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min;
  return (
    <div className="mt-6 flex h-44 items-end justify-between gap-2">
      {evolution.map((e) => {
        const h = range === 0 ? 55 : 18 + Math.round(((e.toPar - min) / range) * 82);
        return (
          <div key={e.id} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">{fmtToPar(e.toPar)}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-lg ${scoreColor(e.toPar)} transition-all`}
                style={{ height: `${h}%` }}
                title={`${e.date}: ${e.strokes} golpes (${fmtToPar(e.toPar)})`}
              />
            </div>
            <span className="text-[10px] text-faint">{e.date}</span>
          </div>
        );
      })}
    </div>
  );
}

function Distribution({
  dist,
}: {
  dist: { birdies: number; pars: number; bogeys: number; doubles: number; holes: number };
}) {
  const total = dist.holes || 1;
  const segments = [
    { label: "Birdies o mejor", value: dist.birdies, color: "bg-positive" },
    { label: "Pares", value: dist.pars, color: "bg-accent" },
    { label: "Bogeys", value: dist.bogeys, color: "bg-warning" },
    { label: "Dobles o peor", value: dist.doubles, color: "bg-negative" },
  ];
  return (
    <div className="glass p-6">
      <h3 className="font-semibold">Reparto de resultados</h3>
      <p className="text-sm text-muted">{dist.holes} hoyos jugados</p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-black/5">
        {segments.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
            <div>
              <p className="text-sm font-semibold">{s.value}</p>
              <p className="text-[11px] text-faint">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
