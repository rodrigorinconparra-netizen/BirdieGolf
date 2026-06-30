"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X, Check, Users, Plus } from "lucide-react";
import { createRoundAction } from "@/app/(app)/rounds/actions";

interface CourseOption {
  id: number;
  name: string;
  city: string | null;
}

interface PlayerOption {
  id: number;
  name: string;
}

interface TeeOption {
  id: number;
  name: string;
  color: string | null;
  gender: "men" | "women" | "any";
  totalMeters: number;
}

const GENDER_SHORT: Record<string, string> = { men: "C", women: "D", any: "M" };

/** Lowercase + strip accents for accent-insensitive matching. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function RoundCreateForm({
  courses,
  teesByCourse,
  players,
  today,
}: {
  courses: CourseOption[];
  teesByCourse: Record<number, TeeOption[]>;
  players: PlayerOption[];
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CourseOption | null>(null);
  const [open, setOpen] = useState(false);

  // Playing partners
  const [partners, setPartners] = useState<PlayerOption[]>([]);
  const [pQuery, setPQuery] = useState("");
  const [pOpen, setPOpen] = useState(false);

  const tees = selected ? (teesByCourse[selected.id] ?? []) : [];

  const pq = norm(pQuery);
  const partnerMatches = pq
    ? players
        .filter((p) => !partners.some((x) => x.id === p.id) && norm(p.name).includes(pq))
        .slice(0, 8)
    : [];

  function addPartner(p: PlayerOption) {
    setPartners((xs) => [...xs, p]);
    setPQuery("");
    setPOpen(false);
  }
  function removePartner(id: number) {
    setPartners((xs) => xs.filter((x) => x.id !== id));
  }

  const q = norm(query);
  const matches = q
    ? courses
        .filter((c) => norm(c.name).includes(q) || (c.city ? norm(c.city).includes(q) : false))
        .slice(0, 8)
    : [];

  function pick(c: CourseOption) {
    setSelected(c);
    setQuery(c.name + (c.city ? ` · ${c.city}` : ""));
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <form action={createRoundAction} className="glass space-y-4 p-6">
      <input type="hidden" name="courseId" value={selected?.id ?? ""} />
      <input type="hidden" name="partners" value={partners.map((p) => p.id).join(",")} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">Campo *</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={query}
            autoComplete="off"
            placeholder="Escribe para buscar un campo…"
            className="field !pl-9 !pr-9"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setOpen(true);
            }}
            onFocus={() => {
              if (!selected) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {selected ? (
            <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-positive" />
          ) : query ? (
            <button
              type="button"
              onClick={clear}
              title="Borrar"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-faint transition hover:bg-black/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {open && q ? (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-black/10 bg-white shadow-lg">
              {matches.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Ningún campo coincide con «{query}».</p>
              ) : (
                matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition hover:bg-accent/5"
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.city ? <span className="text-xs text-faint">{c.city}</span> : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-soft">¿Cuándo la juegas?</span>
        <select name="mode" defaultValue="now" className="field">
          <option value="now">Ahora mismo — la voy a jugar</option>
          <option value="past">Ya la he jugado</option>
        </select>
        <span className="mt-1 block text-xs text-faint">
          Si es ahora, avisaremos a tus seguidores al crearla; si ya la jugaste, cuando completes
          todos los hoyos.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Fecha</span>
          <input type="date" name="playedAt" defaultValue={today} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Barra de salida</span>
          {!selected ? (
            <select disabled className="field" defaultValue="">
              <option value="">Elige primero un campo</option>
            </select>
          ) : tees.length === 0 ? (
            <select name="teeId" className="field" defaultValue="">
              <option value="">El campo no tiene barras</option>
            </select>
          ) : (
            <select name="teeId" className="field" defaultValue="">
              <option value="">Sin especificar</option>
              {tees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.totalMeters ? ` · ${t.totalMeters.toLocaleString("es-ES")} m` : ""}
                  {` · ${GENDER_SHORT[t.gender]}`}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <Users className="h-4 w-4 text-accent" /> Acompañantes
        </span>
        <p className="mb-2 text-xs text-faint">
          Añade a quienes juegan contigo: les anotarás solo los golpes totales por hoyo. Se
          guardará una vuelta en su cuenta y avisaremos a sus seguidores.
        </p>

        {partners.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {partners.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-accent/10 py-1 pl-3 pr-1.5 text-sm font-medium text-accent-deep"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => removePartner(p.id)}
                  title="Quitar"
                  className="grid h-5 w-5 place-items-center rounded-lg text-accent-deep/70 transition hover:bg-black/5 hover:text-accent-deep"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {players.length === 0 ? (
          <p className="text-sm text-faint">No hay otros jugadores todavía.</p>
        ) : (
          <div className="relative">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={pQuery}
              autoComplete="off"
              placeholder="Buscar jugador para añadir…"
              className="field !pl-9"
              onChange={(e) => {
                setPQuery(e.target.value);
                setPOpen(true);
              }}
              onFocus={() => setPOpen(true)}
              onBlur={() => setTimeout(() => setPOpen(false), 120)}
            />
            {pOpen && pq ? (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-black/10 bg-white shadow-lg">
                {partnerMatches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">Ningún jugador coincide.</p>
                ) : (
                  partnerMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addPartner(p);
                      }}
                      className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium transition hover:bg-accent/5"
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={!selected} className="btn-primary disabled:opacity-50">
          Empezar vuelta
        </button>
        <Link href="/rounds" className="btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
