"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  PenLine,
  Clock,
  Save,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayHole, GroupMember, PlayBagClub } from "@/lib/tournament-play";
import { HoleDetailFields, Stepper } from "@/components/hole-detail-fields";
import {
  chooseMarkerAction,
  toggleDetailAction,
  saveHoleScoreAction,
  saveMyRoundAction,
  signCardAction,
} from "@/app/(app)/tournaments/play-actions";

/** Compact scorecard: total strokes per hole for you and your marker. */
function CardTable({
  holes,
  markerName,
}: {
  holes: PlayHole[];
  markerName: string;
}) {
  const out = holes.slice(0, 9);
  const inH = holes.slice(9);
  const sum = (arr: PlayHole[], key: "par" | "selfStrokes" | "markStrokes") =>
    arr.reduce((s, h) => s + ((h[key] as number | null) ?? 0), 0);

  const Cell = ({ children, head }: { children: ReactNode; head?: boolean }) => (
    <td
      className={cn(
        "border-t border-black/5 px-2 py-1.5 text-center text-sm tabular-nums",
        head && "bg-black/[0.03] font-medium",
      )}
    >
      {children}
    </td>
  );

  const Row = ({
    label,
    field,
    strong,
  }: {
    label: string;
    field: "par" | "selfStrokes" | "markStrokes";
    strong?: boolean;
  }) => (
    <tr className={strong ? "font-medium" : ""}>
      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left text-xs text-muted">
        {label}
      </td>
      {out.map((h) => (
        <Cell key={h.holeNumber}>{(h[field] as number | null) ?? "·"}</Cell>
      ))}
      <Cell head>{sum(out, field) || "·"}</Cell>
      {inH.map((h) => (
        <Cell key={h.holeNumber}>{(h[field] as number | null) ?? "·"}</Cell>
      ))}
      {inH.length ? <Cell head>{sum(inH, field) || "·"}</Cell> : null}
      <Cell head>{sum(holes, field) || "·"}</Cell>
    </tr>
  );

  return (
    <div className="glass overflow-x-auto p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-medium text-faint">
              Hoyo
            </th>
            {out.map((h) => (
              <th key={h.holeNumber} className="px-2 py-2 text-center text-xs font-medium text-faint">
                {h.holeNumber}
              </th>
            ))}
            <th className="bg-black/[0.03] px-2 py-2 text-center text-xs font-medium text-faint">
              OUT
            </th>
            {inH.map((h) => (
              <th key={h.holeNumber} className="px-2 py-2 text-center text-xs font-medium text-faint">
                {h.holeNumber}
              </th>
            ))}
            {inH.length ? (
              <th className="bg-black/[0.03] px-2 py-2 text-center text-xs font-medium text-faint">
                IN
              </th>
            ) : null}
            <th className="bg-black/[0.03] px-2 py-2 text-center text-xs font-medium text-faint">
              TOT
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="Par" field="par" />
          <Row label="Tú" field="selfStrokes" strong />
          <Row label={markerName} field="markStrokes" />
        </tbody>
      </table>
    </div>
  );
}

export function TournamentScorecard({
  tournamentId,
  participantId,
  group,
  marker,
  holes: initial,
  bag,
  wantsDetail: initialDetail,
  signed,
  savedRoundId,
}: {
  tournamentId: number;
  participantId: number;
  group: GroupMember[];
  marker: GroupMember | null;
  holes: PlayHole[];
  bag: PlayBagClub[];
  wantsDetail: boolean;
  signed: boolean;
  savedRoundId: number | null;
}) {
  const router = useRouter();
  const [holes, setHoles] = useState<PlayHole[]>(initial);
  const [detail, setDetail] = useState(initialDetail);
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [signing, setSigning] = useState(false);
  const [savingRound, setSavingRound] = useState(false);
  const [roundId, setRoundId] = useState<number | null>(savedRoundId);
  const [error, setError] = useState<string | null>(null);

  async function saveMyRound() {
    setError(null);
    if (dirty.size) for (const idx of dirty) await saveHole(idx);
    setSavingRound(true);
    const r = await saveMyRoundAction(tournamentId);
    setSavingRound(false);
    if (r.error) setError(r.error);
    else if (r.roundId) {
      setRoundId(r.roundId);
      router.refresh();
    }
  }

  const hole = holes[current];

  function patch(p: Partial<PlayHole>) {
    setHoles((hs) => hs.map((h, i) => (i === current ? { ...h, ...p } : h)));
    setDirty((d) => new Set(d).add(current));
  }

  async function saveHole(idx: number) {
    const h = holes[idx];
    setSaving(true);
    await saveHoleScoreAction(tournamentId, h.holeNumber, h.par, h.selfStrokes, h.markStrokes, {
      selfPutts: h.selfPutts,
      fairway: h.fairway,
      teeClub: h.teeClub,
      teeDistanceMeters: h.teeDistanceMeters,
      approachClub: h.approachClub,
      approachDistanceMeters: h.approachDistanceMeters,
      approachResult: h.approachResult,
      sand: h.sand,
      firstPuttDistanceMeters: h.firstPuttDistanceMeters,
      puttResult: h.puttResult,
      penalties: h.penalties,
    });
    setSaving(false);
    setDirty((d) => {
      const n = new Set(d);
      n.delete(idx);
      return n;
    });
  }

  async function goTo(idx: number) {
    if (dirty.has(current)) await saveHole(current);
    setCurrent(Math.max(0, Math.min(holes.length - 1, idx)));
  }

  // ----- Marker selection -----
  if (!marker) {
    const others = group.filter((g) => g.participantId !== participantId);
    return (
      <div className="glass p-6">
        <h3 className="font-semibold">Elige tu marcador</h3>
        <p className="mt-1 text-sm text-muted">
          La persona con la que verificáis la tarjeta: tú marcas la suya y ella la tuya.
        </p>
        {others.length === 0 ? (
          <p className="mt-4 text-sm text-faint">
            Aún no hay nadie más en tu partida. Cuando se apunten aparecerán aquí.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {others.map((g) => (
              <button
                key={g.participantId}
                type="button"
                onClick={async () => {
                  await chooseMarkerAction(tournamentId, g.participantId);
                  router.refresh();
                }}
                className="btn-ghost"
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Per-hole state. "bad" if my card mismatches OR the card I keep for my marker
  // mismatches their own. "ok" if my card is verified (both coincide). Else pending.
  type Tone = "ok" | "bad" | "pending" | "empty";
  function holeTone(h: PlayHole): Tone {
    const myMismatch =
      h.selfStrokes != null && h.markerStrokes != null && h.selfStrokes !== h.markerStrokes;
    const theirMismatch =
      h.markStrokes != null && h.markerSelfStrokes != null && h.markStrokes !== h.markerSelfStrokes;
    if (myMismatch || theirMismatch) return "bad";
    if (h.selfStrokes != null && h.markerStrokes != null && h.selfStrokes === h.markerStrokes)
      return "ok";
    // Amarillo solo si hay algún resultado en el hoyo (mío o del marcador). Si no, gris.
    if (h.selfStrokes != null || h.markerStrokes != null) return "pending";
    return "empty";
  }

  const allVerified = holes.every(
    (h) => h.selfStrokes != null && h.markerStrokes != null && h.selfStrokes === h.markerStrokes,
  );
  const allEntered = holes.every((h) => h.selfStrokes != null);
  const totStrokes = holes.reduce((s, h) => s + (h.selfStrokes ?? 0), 0);
  const played = holes.filter((h) => h.selfStrokes != null).length;

  // Status of MY card on the current hole.
  let verif: { tone: string; icon: typeof Check; text: string };
  if (hole.selfStrokes == null) {
    verif =
      hole.markerStrokes != null
        ? {
            tone: "text-warning",
            icon: AlertTriangle,
            text: `Tu marcador te ha puesto ${hole.markerStrokes}. Apunta tu resultado.`,
          }
        : { tone: "text-warning", icon: Clock, text: "Apunta tu resultado en este hoyo." };
  } else if (hole.markerStrokes == null) {
    verif = {
      tone: "text-muted",
      icon: Clock,
      text: `Hecho (tú: ${hole.selfStrokes}). Pendiente de que ${marker.name} te marque.`,
    };
  } else if (hole.markerStrokes === hole.selfStrokes) {
    verif = { tone: "text-positive", icon: Check, text: `Verificado (${hole.selfStrokes})` };
  } else {
    verif = {
      tone: "text-negative",
      icon: AlertTriangle,
      text: `No coincide — tú: ${hole.selfStrokes} · ${marker.name} te puso: ${hole.markerStrokes}`,
    };
  }
  const VerifIcon = verif.icon;

  // Discrepancy on the card I keep for my marker (what I put vs what they put).
  const markerCardMismatch =
    hole.markStrokes != null &&
    hole.markerSelfStrokes != null &&
    hole.markStrokes !== hole.markerSelfStrokes;

  if (signed) {
    return (
      <div className="space-y-5">
        <div className="glass p-6 text-center">
          <span className="grid mx-auto h-12 w-12 place-items-center rounded-2xl bg-positive/12 text-positive">
            <Check className="h-6 w-6" />
          </span>
          <h3 className="mt-3 text-lg font-semibold">Tarjeta firmada</h3>
          <p className="mt-1 text-sm text-muted">
            {totStrokes} golpes en {played} hoyos. ¡Buena vuelta!
          </p>
          {roundId ? (
            <Link href={`/rounds/${roundId}`} className="btn-ghost mt-4">
              <Flag className="h-4 w-4" /> Ver tu vuelta guardada
            </Link>
          ) : null}
        </div>
        <CardTable holes={holes} markerName={marker.name} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm">
          <span className="text-muted">Marcador: </span>
          <span className="font-medium">{marker.name}</span>
          <span className="text-faint">
            {" "}
            · {played}/{holes.length} hoyos · {totStrokes} golpes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Detalle completo</span>
          <button
            type="button"
            onClick={async () => {
              const v = !detail;
              setDetail(v);
              await toggleDetailAction(tournamentId, v);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              detail ? "bg-accent text-white" : "border border-black/8 bg-white/70 text-ink-soft",
            )}
          >
            {detail ? "Sí" : "No"}
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            title="Actualizar resultados del marcador"
            className="grid h-8 w-8 place-items-center rounded-xl border border-black/8 bg-white/70 text-muted"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {holes.map((h, i) => {
          const tone = holeTone(h);
          return (
            <button
              key={h.holeNumber}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-medium transition",
                i === current
                  ? "bg-accent text-white"
                  : tone === "bad"
                    ? "bg-negative/12 text-negative"
                    : tone === "ok"
                      ? "bg-positive/12 text-positive"
                      : tone === "pending"
                        ? "bg-warning/15 text-warning"
                        : "bg-black/5 text-muted",
              )}
            >
              {h.holeNumber}
            </button>
          );
        })}
      </div>

      <div className="glass space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-faint">HOYO</p>
            <p className="text-3xl font-semibold leading-none">{hole.holeNumber}</p>
          </div>
          <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium text-ink-soft">
            Par {hole.par}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Stepper
              label="Tú"
              value={hole.selfStrokes}
              min={1}
              first={hole.par}
              onChange={(v) => patch({ selfStrokes: v })}
            />
            <p className="mt-1.5 text-xs text-faint">
              {hole.markerStrokes != null
                ? `${marker.name} te ha puesto: ${hole.markerStrokes}`
                : `${marker.name} aún no te ha marcado`}
            </p>
          </div>
          <div>
            <Stepper
              label={`${marker.name} (marcas tú)`}
              value={hole.markStrokes}
              min={1}
              first={hole.par}
              onChange={(v) => patch({ markStrokes: v })}
            />
            <p
              className={cn(
                "mt-1.5 text-xs",
                markerCardMismatch ? "font-medium text-negative" : "text-faint",
              )}
            >
              {hole.markerSelfStrokes != null
                ? `${marker.name} se ha puesto: ${hole.markerSelfStrokes}${markerCardMismatch ? " — no coincide" : ""}`
                : `${marker.name} aún no se ha apuntado`}
            </p>
          </div>
        </div>

        {detail ? (
          <>
            <Stepper
              label="Tus putts"
              value={hole.selfPutts}
              min={0}
              first={2}
              onChange={(v) => patch({ selfPutts: v })}
            />
            <HoleDetailFields
              par={hole.par}
              value={hole}
              bag={bag}
              holeDistanceMeters={hole.holeDistanceMeters}
              onChange={patch}
            />
          </>
        ) : null}

        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl bg-black/[0.02] px-4 py-3 text-sm font-medium",
            verif.tone,
          )}
        >
          <VerifIcon className="h-4 w-4" />
          {verif.text}
        </div>

        {markerCardMismatch ? (
          <div className="flex items-start gap-2 rounded-2xl bg-negative/10 px-4 py-3 text-sm font-medium text-negative">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Aviso: a {marker.name} le has puesto {hole.markStrokes}, pero se ha apuntado{" "}
            {hole.markerSelfStrokes}. Revisadlo.
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
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
            ) : dirty.has(current) ? (
              "Sin guardar"
            ) : (
              "Guardado"
            )}
          </span>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === holes.length - 1 || saving}
            className="btn-primary disabled:opacity-40"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CardTable holes={holes} markerName={marker.name} />

      {error ? (
        <p className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>
      ) : null}

      {/* Guardar en Mis Vueltas — no requiere verificación del marcador. */}
      <div className="glass space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-medium">Guardar en Mis Vueltas</p>
            <p className="text-xs text-muted">
              {roundId
                ? "Tu vuelta de este torneo está guardada."
                : "Guarda tu vuelta aunque el marcador no haya verificado todo."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roundId ? (
              <Link href={`/rounds/${roundId}`} className="btn-ghost">
                <Flag className="h-4 w-4" /> Ver vuelta
              </Link>
            ) : null}
            <button
              type="button"
              disabled={!allEntered || savingRound}
              onClick={saveMyRound}
              title={allEntered ? "" : "Apunta tu resultado en todos los hoyos"}
              className="btn-ghost disabled:opacity-50"
            >
              {savingRound ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {roundId ? "Actualizar" : "Guardar vuelta"}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!allVerified || signing}
        onClick={async () => {
          setError(null);
          if (dirty.size) {
            for (const idx of dirty) await saveHole(idx);
          }
          setSigning(true);
          const r = await signCardAction(tournamentId);
          setSigning(false);
          if (r.error) setError(r.error);
          else router.refresh();
        }}
        className="btn-primary w-full disabled:opacity-50"
      >
        {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
        {allVerified ? "Firmar y finalizar tarjeta" : "Firma disponible cuando todo esté verificado"}
      </button>
    </div>
  );
}
