"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, Search, MapPin, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CourseForm, type CourseFormInitial } from "@/components/course-form";
import { searchOsmCoursesAction, getOsmPrefillAction } from "../actions";
import type { OsmSearchResult } from "@/lib/osm-courses";

interface Prefill {
  initial: CourseFormInitial;
  hasHoleData: boolean;
  sourceName: string;
}

export default function ImportCoursePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OsmSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startSearch(async () => {
      const r = await searchOsmCoursesAction(query);
      if (r.error) {
        setError(r.error);
        setResults([]);
      } else {
        setResults(r.results ?? []);
      }
    });
  }

  async function onPick(c: OsmSearchResult) {
    setError(null);
    setLoadingId(`${c.osmType}/${c.osmId}`);
    const r = await getOsmPrefillAction(c.osmType, c.osmId);
    setLoadingId(null);
    if (r.error || !r.prefill) {
      setError(r.error ?? "No se pudo cargar el campo");
      return;
    }
    const p = r.prefill;
    setPrefill({
      sourceName: p.name,
      hasHoleData: p.hasHoleData,
      initial: {
        name: p.name,
        city: p.city,
        region: p.region,
        country: p.country ?? "España",
        holesCount: p.holesCount,
        holes: p.holes.map((h) => ({
          par: h.par,
          strokeIndex: h.strokeIndex,
          distanceMeters: h.distanceMeters,
        })),
      },
    });
  }

  // Step 2: confirm & save the pre-filled course
  if (prefill) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPrefill(null)}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la búsqueda
        </button>

        <PageHeader
          title="Revisa y guarda"
          subtitle="Datos traídos de OpenStreetMap. Confirma los pares y ajusta lo que haga falta."
        />

        <CourseForm
          key={prefill.sourceName}
          initial={prefill.initial}
          submitLabel="Guardar campo"
          notice={
            <div className="glass flex items-start gap-2 p-4 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-ink-soft">
                {prefill.hasHoleData
                  ? "Pares cargados desde OpenStreetMap. Revísalos antes de guardar."
                  : "OpenStreetMap no tenía los pares de este campo: vienen por defecto a 4 — corrígelos según la tarjeta del campo."}
              </span>
            </div>
          }
        />
      </>
    );
  }

  // Step 1: search
  return (
    <>
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Campos
      </Link>

      <PageHeader
        title="Importar campo"
        subtitle="Busca en OpenStreetMap (incluye campos de España) y autorrellena el formulario."
      />

      <form onSubmit={onSearch} className="glass flex items-center gap-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del campo o club… (ej. El Saler, Sotogrande)"
          className="field"
        />
        <button type="submit" disabled={searching} className="btn-primary !px-4">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      {error ? (
        <p className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>
      ) : null}

      {results !== null && results.length === 0 && !searching ? (
        <p className="text-sm text-muted">
          Sin resultados. Prueba otro nombre, o crea el campo a mano desde{" "}
          <Link href="/courses/new" className="font-medium text-accent">
            Campo manual
          </Link>
          .
        </p>
      ) : null}

      <div className="space-y-3">
        {results?.map((c) => {
          const place = [c.city, c.region, c.country].filter(Boolean).join(", ");
          const busy = loadingId === `${c.osmType}/${c.osmId}`;
          return (
            <button
              type="button"
              key={`${c.osmType}/${c.osmId}`}
              onClick={() => onPick(c)}
              disabled={busy}
              className="glass flex w-full items-center justify-between gap-3 p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-faint">
                  <MapPin className="h-3 w-3" /> {place || "Ubicación no especificada"}
                  {c.holesCount ? ` · ${c.holesCount} hoyos` : ""}
                </p>
              </div>
              {busy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
              ) : (
                <span className="shrink-0 text-sm font-medium text-accent">Usar →</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
