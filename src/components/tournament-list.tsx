"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface TournamentItem {
  id: number;
  name: string;
  visibility: string;
  format: string; // "league" | "single"
  playDate: Date | string | null;
  status: string | null;
  courseName: string | null;
  joined: boolean;
  owned: boolean;
}

type Filter = "all" | "league" | "single" | "joined" | "not";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "league", label: "Ligas" },
  { key: "single", label: "Torneos" },
  { key: "joined", label: "Apuntado" },
  { key: "not", label: "No apuntado" },
];

function matches(t: TournamentItem, f: Filter): boolean {
  switch (f) {
    case "league":
      return t.format === "league";
    case "single":
      return t.format !== "league";
    case "joined":
      return t.owned || t.joined;
    case "not":
      return !t.owned && !t.joined;
    default:
      return true;
  }
}

export function TournamentList({ items }: { items: TournamentItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = items.filter((t) => matches(t, filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = items.filter((t) => matches(t, f.key)).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-2xl px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-accent text-white"
                  : "border border-black/8 bg-white/70 text-ink-soft hover:bg-white",
              )}
            >
              {f.label}
              <span className={cn("ml-1.5 text-xs", active ? "text-white/80" : "text-faint")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="glass p-5 text-sm text-muted">No hay nada en esta categoría.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="glass p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{t.name}</h3>
                {t.visibility === "private" ? (
                  <Lock className="h-4 w-4 shrink-0 text-faint" />
                ) : (
                  <Globe className="h-4 w-4 shrink-0 text-faint" />
                )}
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {t.courseName ?? "Sin campo"}
                {t.playDate
                  ? ` · ${new Date(t.playDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                  : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={t.format === "league" ? "accent" : "neutral"}>
                  {t.format === "league" ? "Liga" : "Torneo"}
                </Badge>
                {t.owned ? (
                  <Badge tone="accent">Tuyo</Badge>
                ) : t.joined ? (
                  <Badge tone="positive">Apuntado</Badge>
                ) : null}
                {t.status === "finished" ? <Badge tone="neutral">Finalizado</Badge> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
