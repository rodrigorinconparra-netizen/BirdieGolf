import { BarChart3, CircleDot, Flag } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPlayerStats, type ClubStat, type PuttingStats } from "@/lib/stats";
import { getStrokesGainedAverage } from "@/lib/strokes-gained";
import { StrokesGainedCard } from "@/components/strokes-gained-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  wood: "Madera",
  hybrid: "Híbrido",
  iron: "Hierro",
  wedge: "Wedge",
  putter: "Putter",
  other: "Otro",
};

const DISPERSION = [
  { key: "left", label: "Izq", color: "#6aa6c9" },
  { key: "center", label: "Centro", color: "#2faf5a" },
  { key: "right", label: "Der", color: "#e0a341" },
  { key: "short", label: "Corta", color: "#c2703f" },
  { key: "long", label: "Larga", color: "#9a8c74" },
] as const;

function ClubCard({ c }: { c: ClubStat }) {
  const total =
    c.dispersion.left +
    c.dispersion.center +
    c.dispersion.right +
    c.dispersion.short +
    c.dispersion.long;
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">{c.name}</h4>
          <Badge>{KIND_LABEL[c.kind] ?? "Palo"}</Badge>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">
            {c.avgDistance != null ? c.avgDistance : "—"}
            {c.avgDistance != null ? <span className="text-xs text-faint"> m</span> : null}
          </p>
          <p className="text-[11px] text-faint">{c.uses} golpes</p>
        </div>
      </div>

      {total > 0 ? (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/5">
            {DISPERSION.map((d) => {
              const v = c.dispersion[d.key];
              return v > 0 ? (
                <div
                  key={d.key}
                  style={{ width: `${(v / total) * 100}%`, backgroundColor: d.color }}
                />
              ) : null;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {DISPERSION.map((d) => (
              <span key={d.key} className="flex items-center gap-1.5 text-muted">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                {d.label} <span className="font-medium text-ink">{c.dispersion[d.key]}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-faint">Sin dirección registrada.</p>
      )}
    </div>
  );
}

function PuttingSection({ p }: { p: PuttingStats }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CircleDot className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-soft">Putt</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="glass p-4">
          <p className="text-2xl font-semibold">
            {p.avgFirstPuttDistance ?? "—"}
            {p.avgFirstPuttDistance != null ? <span className="text-sm text-faint"> m</span> : null}
          </p>
          <p className="text-[11px] text-faint">Dist. media 1er putt</p>
        </div>
        <div className="glass p-4">
          <p className="text-2xl font-semibold text-positive">{p.onePutts}</p>
          <p className="text-[11px] text-faint">1-putts</p>
        </div>
        <div className="glass p-4">
          <p className="text-2xl font-semibold text-negative">{p.threePutts}</p>
          <p className="text-[11px] text-faint">3-putts</p>
        </div>
        <div className="glass p-4">
          <p className="text-2xl font-semibold">{p.totalPutts}</p>
          <p className="text-[11px] text-faint">Putts totales</p>
        </div>
      </div>

      <div className="glass p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Putts cortos (menos de 2 m)</h3>
            <p className="text-sm text-muted">
              Incluye cada segundo putt: si embocas en 2 lo metes, si haces 3 lo fallas.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-accent">
              {p.shortPct != null ? `${p.shortPct}%` : "—"}
            </p>
            <p className="text-[11px] text-faint">
              {p.shortMade}/{p.shortAttempts} metidos
            </p>
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] px-5 py-3 text-xs font-medium text-faint">
          <span>Distancia 1er putt</span>
          <span className="text-right">Intentos</span>
          <span className="text-right">Metidos</span>
          <span className="text-right">3-putts</span>
        </div>
        {p.buckets.map((b) => (
          <div
            key={b.label}
            className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-t border-black/5 px-5 py-3 text-sm"
          >
            <span className="font-medium">{b.label}</span>
            <span className="text-right text-muted">{b.attempts}</span>
            <span className="text-right font-medium text-positive">
              {b.attempts ? `${b.madePct}%` : "—"}
            </span>
            <span className="text-right font-medium text-negative">
              {b.attempts ? `${b.threePuttPct}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StatsPage() {
  const session = await getSession();
  const stats = session ? await getPlayerStats(session.userId) : null;
  const sg = session ? await getStrokesGainedAverage(session.userId) : null;

  if (!stats || !stats.hasData) {
    return (
      <>
        <PageHeader title="Estadísticas" subtitle="Tu juego, palo a palo." />
        <EmptyState
          icon={BarChart3}
          title="Aún no hay datos"
          description="Registra vueltas con el detalle de cada golpe (palo, metros, dirección) para ver tus estadísticas por palo y por putt."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Estadísticas"
        subtitle="Medias y dispersión por palo, y detalle de tu putt."
      />

      {sg ? (
        <StrokesGainedCard sg={sg} title="Strokes Gained (media por vuelta)" />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-soft">Por palo (del drive al wedge)</h2>
        </div>
        {stats.perClub.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no has registrado el palo de tus golpes. Hazlo en el editor de vuelta.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.perClub.map((c) => (
              <ClubCard key={c.name} c={c} />
            ))}
          </div>
        )}
      </section>

      <PuttingSection p={stats.putting} />
    </>
  );
}
