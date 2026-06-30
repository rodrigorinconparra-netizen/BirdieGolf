"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FairwayValue } from "@/app/(app)/rounds/actions";

export interface BagClub {
  id: number;
  name: string;
  kind: string;
}

/** Per-hole detail shared by the normal round editor and the tournament card. */
export interface HoleDetail {
  fairway: FairwayValue;
  teeClub: string | null;
  teeDistanceMeters: number | null;
  approachClub: string | null;
  approachDistanceMeters: number | null;
  approachResult: FairwayValue;
  sand: boolean | null;
  firstPuttDistanceMeters: number | null;
  puttResult: FairwayValue;
  penalties: number | null;
}

const FAIRWAYS = [
  { value: "left", label: "Izq" },
  { value: "hit", label: "Calle" },
  { value: "right", label: "Der" },
  { value: "short", label: "Corta" },
  { value: "long", label: "Larga" },
] as const;

const GREEN_MISS = [
  { value: "hit", label: "En green" },
  { value: "left", label: "Izq" },
  { value: "right", label: "Der" },
  { value: "short", label: "Corta" },
  { value: "long", label: "Larga" },
] as const;

const PUTT_MISS = [
  { value: "hit", label: "Metido" },
  { value: "left", label: "Izq" },
  { value: "right", label: "Der" },
  { value: "short", label: "Corto" },
  { value: "long", label: "Largo" },
] as const;

const YES_NO = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
] as const;

export function Stepper({
  label,
  value,
  min = 0,
  first,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  first?: number;
  onChange: (v: number | null) => void;
}) {
  const start = first ?? min;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-soft">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value == null ? start : Math.max(min, value - 1))}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-black/8 bg-white/70 active:scale-95"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-2xl font-semibold tabular-nums">{value ?? "–"}</span>
        <button
          type="button"
          onClick={() => onChange(value == null ? start : value + 1)}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-black/8 bg-white/70 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm font-medium transition active:scale-95",
              active
                ? "bg-accent text-white"
                : "border border-black/8 bg-white/70 text-ink-soft hover:bg-white",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ClubSelect({
  label,
  value,
  bag,
  onChange,
}: {
  label: string;
  value: string | null;
  bag: BagClub[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-soft">{label}</p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="field"
      >
        <option value="">— Palo —</option>
        {bag.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetersInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  hint?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-soft">{label}</p>
      <div className="relative">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="—"
          className="field pr-9"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">
          m
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * The full per-hole detail (salida, golpe a green, primer putt, bunker, penalidades),
 * identical to a normal round. Reused by the round editor and the tournament card.
 */
export function HoleDetailFields({
  par,
  value,
  bag,
  holeDistanceMeters,
  onChange,
}: {
  par: number | null;
  value: HoleDetail;
  bag: BagClub[];
  holeDistanceMeters: number | null;
  onChange: (p: Partial<HoleDetail>) => void;
}) {
  const isPar3 = (par ?? 4) <= 3;

  // Entering the metres-to-flag auto-derives the tee shot distance.
  function setApproachDistance(v: number | null) {
    const update: Partial<HoleDetail> = { approachDistanceMeters: v };
    if (!isPar3 && holeDistanceMeters != null && v != null) {
      const drive = holeDistanceMeters - v;
      update.teeDistanceMeters = drive > 0 ? drive : null;
    }
    onChange(update);
  }

  const total = holeDistanceMeters;
  const driveHint =
    total == null
      ? undefined
      : value.approachDistanceMeters != null && total - value.approachDistanceMeters > 0
        ? `Auto: ${total} − ${value.approachDistanceMeters} = ${total - value.approachDistanceMeters} m (editable)`
        : "Se calcula al poner los metros a bandera";

  return (
    <>
      {!isPar3 ? (
        <div className="space-y-3 rounded-2xl bg-black/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Salida</p>
            {total != null ? <span className="text-xs text-faint">Hoyo {total} m</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ClubSelect
              label="Palo"
              value={value.teeClub}
              bag={bag}
              onChange={(v) => onChange({ teeClub: v })}
            />
            <MetersInput
              label="Metros del drive"
              value={value.teeDistanceMeters}
              onChange={(v) => onChange({ teeDistanceMeters: v })}
              hint={driveHint}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-soft">Calle</p>
            <Segmented
              options={FAIRWAYS}
              value={value.fairway}
              onChange={(v) => onChange({ fairway: v })}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          {isPar3 ? "Golpe de salida (a green)" : "Golpe a green"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClubSelect
            label="Palo"
            value={value.approachClub}
            bag={bag}
            onChange={(v) => onChange({ approachClub: v })}
          />
          <MetersInput
            label="Metros a bandera"
            value={value.approachDistanceMeters}
            onChange={setApproachDistance}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">¿Dónde quedó?</p>
          <Segmented
            options={GREEN_MISS}
            value={value.approachResult}
            onChange={(v) => onChange({ approachResult: v })}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Primer putt</p>
        <MetersInput
          label="Metros a bandera"
          value={value.firstPuttDistanceMeters}
          onChange={(v) => onChange({ firstPuttDistanceMeters: v })}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">¿Dónde falló?</p>
          <Segmented
            options={PUTT_MISS}
            value={value.puttResult}
            onChange={(v) => onChange({ puttResult: v })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-soft">¿Bunker (arena)?</p>
          <Segmented
            options={YES_NO}
            value={value.sand == null ? null : value.sand ? "yes" : "no"}
            onChange={(v) => onChange({ sand: v == null ? null : v === "yes" })}
          />
        </div>
        <Stepper
          label="Penalidades"
          value={value.penalties ?? 0}
          min={0}
          onChange={(v) => onChange({ penalties: v ?? 0 })}
        />
      </div>
    </>
  );
}
