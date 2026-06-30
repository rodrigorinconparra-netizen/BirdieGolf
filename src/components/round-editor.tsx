"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveRoundHoleAction,
  savePartnerHoleAction,
  type FairwayValue,
} from "@/app/(app)/rounds/actions";
import { HoleDetailFields, Stepper, type BagClub } from "@/components/hole-detail-fields";

export type { BagClub };

export interface RoundEditorPartner {
  userId: number;
  name: string;
  strokesByHole: Record<number, number | null>;
}

export interface EditorHole {
  holeNumber: number;
  par: number | null;
  strokes: number | null;
  putts: number | null;
  penalties: number | null;
  fairway: FairwayValue;
  teeClub: string | null;
  teeDistanceMeters: number | null;
  approachClub: string | null;
  approachDistanceMeters: number | null;
  approachResult: FairwayValue;
  sand: boolean | null;
  firstPuttDistanceMeters: number | null;
  puttResult: FairwayValue;
  /** Total length of the hole (from the round's tee, else the course). */
  holeDistanceMeters: number | null;
}

export function RoundEditor({
  roundId,
  holes: initial,
  bag,
  partners = [],
}: {
  roundId: number;
  holes: EditorHole[];
  bag: BagClub[];
  partners?: RoundEditorPartner[];
}) {
  const [holes, setHoles] = useState<EditorHole[]>(
    initial.map((h) => ({ ...h, penalties: h.penalties ?? 0 })),
  );
  const [partnerStrokes, setPartnerStrokes] = useState<
    Record<number, Record<number, number | null>>
  >(() => Object.fromEntries(partners.map((p) => [p.userId, { ...p.strokesByHole }])));

  async function savePartner(
    userId: number,
    holeNumber: number,
    v: number | null,
  ): Promise<void> {
    setPartnerStrokes((s) => ({ ...s, [userId]: { ...s[userId], [holeNumber]: v } }));
    await savePartnerHoleAction(roundId, userId, holeNumber, v);
  }
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(
    () => new Set(initial.filter((h) => h.strokes != null).map((h) => h.holeNumber)),
  );
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  const hole = holes[current];

  function patch(p: Partial<EditorHole>) {
    setHoles((hs) => hs.map((h, i) => (i === current ? { ...h, ...p } : h)));
    setDirty((d) => new Set(d).add(hole.holeNumber));
    setSaved((s) => {
      const n = new Set(s);
      n.delete(hole.holeNumber);
      return n;
    });
  }

  async function save(h: EditorHole): Promise<void> {
    setSaving(true);
    const res = await saveRoundHoleAction(roundId, h.holeNumber, {
      par: h.par,
      strokes: h.strokes,
      putts: h.putts,
      penalties: h.penalties ?? 0,
      fairway: h.fairway,
      teeClub: h.teeClub,
      teeDistanceMeters: h.teeDistanceMeters,
      approachClub: h.approachClub,
      approachDistanceMeters: h.approachDistanceMeters,
      approachResult: h.approachResult,
      sand: h.sand,
      firstPuttDistanceMeters: h.firstPuttDistanceMeters,
      puttResult: h.puttResult,
    });
    setSaving(false);
    if (res.ok) {
      setSaved((s) => new Set(s).add(h.holeNumber));
      setDirty((d) => {
        const n = new Set(d);
        n.delete(h.holeNumber);
        return n;
      });
    }
  }

  async function goTo(index: number) {
    if (dirty.has(hole.holeNumber)) await save(hole);
    setCurrent(Math.max(0, Math.min(holes.length - 1, index)));
  }

  const played = holes.filter((h) => h.strokes != null);
  const totalStrokes = played.reduce((s, h) => s + (h.strokes ?? 0), 0);
  const parPlayed = played.reduce((s, h) => s + (h.par ?? 0), 0);
  const totalPutts = holes.reduce((s, h) => s + (h.putts ?? 0), 0);
  const vs = played.length ? totalStrokes - parPlayed : null;
  const vsLabel = vs == null ? "–" : vs === 0 ? "E" : vs > 0 ? `+${vs}` : `${vs}`;

  const gir =
    hole.strokes != null && hole.putts != null && hole.par != null
      ? hole.strokes - hole.putts <= hole.par - 2
      : null;

  return (
    <div className="space-y-5">
      <div className="glass grid grid-cols-3 divide-x divide-black/5 p-4 text-center">
        <div>
          <p className="text-2xl font-semibold">{totalStrokes || "–"}</p>
          <p className="text-[11px] text-faint">Golpes ({played.length})</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-accent">{vsLabel}</p>
          <p className="text-[11px] text-faint">Al par</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{totalPutts || "–"}</p>
          <p className="text-[11px] text-faint">Putts</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {holes.map((h, i) => (
          <button
            key={h.holeNumber}
            type="button"
            onClick={() => goTo(i)}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-medium transition",
              i === current
                ? "bg-accent text-white"
                : saved.has(h.holeNumber)
                  ? "bg-accent/12 text-accent-deep"
                  : "bg-black/5 text-muted",
            )}
          >
            {h.holeNumber}
          </button>
        ))}
      </div>

      <div className="glass space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-faint">HOYO</p>
            <p className="text-3xl font-semibold leading-none">{hole.holeNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            {gir != null ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  gir ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative",
                )}
              >
                {gir ? "GIR ✓" : "Sin GIR"}
              </span>
            ) : null}
            <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium text-ink-soft">
              Par {hole.par ?? "–"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stepper
            label="Golpes"
            value={hole.strokes}
            min={1}
            first={hole.par ?? 4}
            onChange={(v) => patch({ strokes: v })}
          />
          <Stepper
            label="Putts"
            value={hole.putts}
            min={0}
            first={2}
            onChange={(v) => patch({ putts: v })}
          />
        </div>

        <HoleDetailFields
          par={hole.par}
          value={hole}
          bag={bag}
          holeDistanceMeters={hole.holeDistanceMeters}
          onChange={patch}
        />

        {partners.length > 0 ? (
          <div className="space-y-4 border-t border-black/5 pt-5">
            <p className="text-xs font-medium text-faint">
              ACOMPAÑANTES · golpes totales en este hoyo
            </p>
            <div className="grid grid-cols-2 gap-4">
              {partners.map((p) => (
                <Stepper
                  key={p.userId}
                  label={p.name}
                  value={partnerStrokes[p.userId]?.[hole.holeNumber] ?? null}
                  min={1}
                  first={hole.par ?? 4}
                  onChange={(v) => savePartner(p.userId, hole.holeNumber, v)}
                />
              ))}
            </div>
            <p className="text-xs text-faint">
              Se guarda en la vuelta de cada acompañante. Ellos pueden completar el detalle
              desde su cuenta.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0 || saving}
            className="btn-ghost disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>

          <span className="text-xs text-faint">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
              </span>
            ) : saved.has(hole.holeNumber) ? (
              <span className="inline-flex items-center gap-1 text-positive">
                <Check className="h-3 w-3" /> Guardado
              </span>
            ) : dirty.has(hole.holeNumber) ? (
              "Sin guardar"
            ) : (
              ""
            )}
          </span>

          {current === holes.length - 1 ? (
            <button type="button" onClick={() => save(hole)} disabled={saving} className="btn-primary">
              Guardar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={saving}
              className="btn-primary"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
