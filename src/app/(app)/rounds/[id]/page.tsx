import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2, Sparkles, Globe, Lock, MapPin } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getRound } from "@/lib/rounds";
import { listCourses } from "@/lib/courses";
import { getBag } from "@/lib/bag";
import { PageHeader } from "@/components/ui/page-header";
import { RoundEditor, type EditorHole } from "@/components/round-editor";
import { RoundScorecard } from "@/components/round-scorecard";
import { StrokesGainedCard } from "@/components/strokes-gained-card";
import { computeStrokesGained } from "@/lib/strokes-gained";
import { ShareRoundButton } from "@/components/share-round-button";
import { deleteRoundAction, changeRoundCourseAction, type FairwayValue } from "../actions";
import { toggleRoundPublicAction } from "../../social/actions";

export const dynamic = "force-dynamic";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const data = await getRound(Number(id), session.userId);
  if (!data) notFound();

  const { round, course, holes, holeDistances, handicap, partners } = data;
  const sg = computeStrokesGained(
    holes.map((h) => ({
      holeNumber: h.holeNumber,
      par: h.par,
      strokes: h.strokes,
      putts: h.putts,
      fairway: h.fairway,
      teeDistanceMeters: h.teeDistanceMeters,
      approachDistanceMeters: h.approachDistanceMeters,
      firstPuttDistanceMeters: h.firstPuttDistanceMeters,
    })),
    holeDistances,
    handicap,
  );
  const allCourses = await listCourses();
  const bag = (await getBag(session.userId)).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));
  const editorHoles: EditorHole[] = holes.map((h) => ({
    holeNumber: h.holeNumber,
    par: h.par,
    strokes: h.strokes,
    putts: h.putts,
    penalties: h.penalties,
    fairway: h.fairway as FairwayValue,
    teeClub: h.teeClub,
    teeDistanceMeters: h.teeDistanceMeters,
    approachClub: h.approachClub,
    approachDistanceMeters: h.approachDistanceMeters,
    approachResult: h.approachResult as FairwayValue,
    sand: h.sand,
    firstPuttDistanceMeters: h.firstPuttDistanceMeters,
    puttResult: h.puttResult as FairwayValue,
    holeDistanceMeters: holeDistances[h.holeNumber] ?? null,
  }));

  const dateLabel = new Date(round.playedAt).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Link
        href="/rounds"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Vueltas
      </Link>

      <PageHeader
        title={course?.name ?? "Vuelta"}
        subtitle={`${dateLabel}${round.tee ? ` · ${round.tee}` : ""}`}
        action={
          <ShareRoundButton roundId={round.id} courseName={course?.name ?? "Mi vuelta"} />
        }
      />

      <form
        action={changeRoundCourseAction}
        className="glass flex flex-wrap items-end gap-3 p-4"
      >
        <input type="hidden" name="roundId" value={round.id} />
        <label className="block flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <MapPin className="h-4 w-4 text-accent" /> Campo de la vuelta
          </span>
          <select
            name="courseId"
            defaultValue={round.courseId != null ? String(round.courseId) : ""}
            className="field"
          >
            <option value="">Sin campo</option>
            {allCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` · ${c.city}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost">
          Cambiar campo
        </button>
      </form>

      <RoundScorecard holes={holes} />

      <StrokesGainedCard sg={sg} />

      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
            {round.isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold">Vuelta pública</p>
            <p className="text-sm text-muted">
              {round.isPublic
                ? "Visible en tu perfil y en el feed de la comunidad."
                : "Privada — solo tú la ves."}
            </p>
          </div>
        </div>
        <form action={toggleRoundPublicAction}>
          <input type="hidden" name="roundId" value={round.id} />
          <input type="hidden" name="isPublic" value={String(!round.isPublic)} />
          <button type="submit" className={round.isPublic ? "btn-ghost" : "btn-primary"}>
            {round.isPublic ? "Hacer privada" : "Hacer pública"}
          </button>
        </form>
      </div>

      <h2 className="pt-2 text-sm font-semibold text-ink-soft">Editar hoyo a hoyo</h2>
      <RoundEditor
        roundId={round.id}
        holes={editorHoles}
        bag={bag}
        partners={partners.map((p) => ({
          userId: p.userId,
          name: p.name,
          strokesByHole: p.strokesByHole,
        }))}
      />

      {editorHoles.some((h) => h.strokes != null) ? (
        <div className="glass flex flex-wrap items-center justify-between gap-3 p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">Coach IA</h3>
              <p className="text-sm text-muted">
                Pídele que analice esta vuelta y te diga qué mejorar
              </p>
            </div>
          </div>
          <Link
            href={`/coach?round=${round.id}&start=${encodeURIComponent(
              `Analiza mi vuelta del ${dateLabel} en ${course?.name ?? "este campo"}: dime qué hice bien, dónde fallé y qué debería entrenar.`,
            )}`}
            className="btn-primary"
          >
            <Sparkles className="h-4 w-4" /> Analizar con el Coach
          </Link>
        </div>
      ) : null}

      <form action={deleteRoundAction} className="pt-2">
        <input type="hidden" name="id" value={round.id} />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-2xl border border-negative/20 bg-negative/5 px-4 py-2.5 text-sm font-medium text-negative transition hover:bg-negative/10"
        >
          <Trash2 className="h-4 w-4" /> Eliminar vuelta
        </button>
      </form>
    </>
  );
}
