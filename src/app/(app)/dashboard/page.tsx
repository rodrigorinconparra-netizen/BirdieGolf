import Link from "next/link";
import {
  Flag,
  Target,
  Crosshair,
  Goal,
  Activity,
  CircleDot,
  Sparkles,
  Plus,
  LineChart,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getDashboardData, type Trend } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function t(trend: Trend | undefined): { delta?: string; deltaPositive: boolean | null } {
  if (!trend || trend.delta == null) return { deltaPositive: null };
  return { delta: trend.delta, deltaPositive: trend.positive };
}

export default async function DashboardPage() {
  const session = await getSession();
  const firstName = session?.name.split(" ")[0] ?? "jugador";
  const data = session
    ? await getDashboardData(session.userId)
    : null;

  const m = data?.overall;

  return (
    <>
      <PageHeader
        title={`Hola, ${firstName}`}
        subtitle="Resumen de tu rendimiento a partir de tus vueltas registradas."
        action={
          <Link href="/rounds/new" prefetch={false} className="btn-primary">
            <Plus className="h-4 w-4" /> Nueva vuelta
          </Link>
        }
      />

      {!m ? (
        <EmptyState
          icon={Flag}
          title="Aún no hay datos"
          description="Registra tu primera vuelta y tus métricas cobrarán vida aquí."
          action={
            <Link href="/rounds/new" prefetch={false} className="btn-primary">
              <Plus className="h-4 w-4" /> Registrar vuelta
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-positive" /> Mejora
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-negative" /> Empeora
            </span>
            <span className="text-faint">· {data!.roundsCount} vuelta(s)</span>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Hándicap"
              value={data!.handicap != null ? data!.handicap.toFixed(1) : "—"}
              icon={Activity}
            />
            <StatCard
              label="Scoring medio"
              value={m.avgStrokes.toFixed(0)}
              icon={Flag}
              {...t(data!.trends?.toPar)}
            />
            <StatCard
              label="Greens en regulación"
              value={m.girPct.toFixed(0)}
              unit="%"
              icon={Target}
              {...t(data!.trends?.girPct)}
            />
            <StatCard
              label="Calles cogidas"
              value={m.fairwayPct.toFixed(0)}
              unit="%"
              icon={Crosshair}
              {...t(data!.trends?.fairwayPct)}
            />
            <StatCard
              label="Putts / vuelta"
              value={m.puttsPerRound.toFixed(1)}
              icon={CircleDot}
              {...t(data!.trends?.puttsPerRound)}
            />
            <StatCard
              label="Up & Down"
              value={m.scramblePct.toFixed(0)}
              unit="%"
              icon={Goal}
              {...t(data!.trends?.scramblePct)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Evolución del scoring</h3>
                <Badge tone="neutral">al par por vuelta</Badge>
              </div>
              <ScoringChart evolution={data!.evolution} />
            </div>

            <div className="glass flex flex-col p-6">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">Coach IA</h3>
              </div>
              {data!.weakest ? (
                <p className="mt-3 flex-1 text-sm text-muted">
                  Tu punto a mejorar ahora es{" "}
                  <span className="font-medium text-ink">{data!.weakest.label}</span> (
                  {data!.weakest.hint}). Pídele al Coach un plan de entrenamiento.
                </p>
              ) : (
                <p className="mt-3 flex-1 text-sm text-muted">
                  Pregúntale al Coach qué entrenar para seguir bajando tus resultados.
                </p>
              )}
              <Link
                href={`/coach?start=${encodeURIComponent(
                  data!.weakest
                    ? `Mi punto débil es ${data!.weakest.label}. Dame un plan de entrenamiento para mejorarlo.`
                    : "¿Qué debería entrenar para bajar mis resultados?",
                )}`}
                prefetch={false}
                className="btn-ghost mt-4 w-full"
              >
                Hablar con el Coach
              </Link>
            </div>
          </div>

          <Distribution dist={data!.distribution} />
        </>
      )}
    </>
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
        Registra vueltas para ver tu evolución.
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
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
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
