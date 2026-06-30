import Link from "next/link";
import {
  Dumbbell,
  Sparkles,
  Plus,
  Trash2,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listTrainings } from "@/lib/trainings";
import { getTrainingEvaluations, type TrainingEval } from "@/lib/training-eval";
import { CATEGORY_LABEL, type TrainingCategory } from "@/lib/training-meta";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addTrainingAction,
  toggleTrainingCompletedAction,
  deleteTrainingAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Training = Awaited<ReturnType<typeof listTrainings>>[number];

function fmtVal(n: number, unit: string) {
  return unit === "%" ? `${Math.round(n)}%` : n.toFixed(1);
}

function EvalRow({ e }: { e: TrainingEval }) {
  if (e.status === "no_after" || e.status === "no_before" || e.status === "no_metric") {
    const msg =
      e.status === "no_after"
        ? "Aún sin vueltas posteriores para evaluar"
        : e.status === "no_before"
          ? "Sin vueltas previas para comparar"
          : `Sin datos posteriores de ${e.metricLabel}`;
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
        <Clock className="h-3.5 w-3.5" /> {msg}
      </p>
    );
  }
  const tone =
    e.status === "improved"
      ? "bg-positive/10 text-positive"
      : e.status === "worse"
        ? "bg-negative/10 text-negative"
        : "bg-black/5 text-muted";
  const Icon =
    e.status === "improved" ? TrendingUp : e.status === "worse" ? TrendingDown : Minus;
  const word =
    e.status === "improved" ? "Mejoró" : e.status === "worse" ? "Empeoró" : "Sin cambios";
  return (
    <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>
        {word} · {e.metricLabel}: {fmtVal(e.before!, e.unit)} → {fmtVal(e.after!, e.unit)} (
        {e.beforeRounds} vs {e.afterRounds} vueltas)
      </span>
    </div>
  );
}

function TrainingCard({ t, evaluation }: { t: Training; evaluation?: TrainingEval }) {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{t.title}</h4>
            <Badge>{CATEGORY_LABEL[t.category as TrainingCategory]}</Badge>
            {t.source === "ai" ? (
              <Badge tone="accent">
                <Sparkles className="h-3 w-3" /> IA
              </Badge>
            ) : null}
            {t.completed ? <Badge tone="positive">Hecho</Badge> : null}
          </div>
          {t.description ? <p className="mt-1.5 text-sm text-muted">{t.description}</p> : null}
          {t.goal ? (
            <p className="mt-1 text-sm text-ink-soft">
              <span className="font-medium">Objetivo:</span> {t.goal}
            </p>
          ) : null}
          {t.performedAt ? (
            <p className="mt-1 text-xs text-faint">
              Realizado el {new Date(t.performedAt).toLocaleDateString("es-ES")}
            </p>
          ) : null}
        </div>
        <form action={deleteTrainingAction}>
          <input type="hidden" name="id" value={t.id} />
          <button
            type="submit"
            title="Eliminar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-faint transition hover:bg-negative/10 hover:text-negative"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>

      <form action={toggleTrainingCompletedAction} className="mt-3">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="completed" value={String(t.completed)} />
        <button
          type="submit"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium transition",
            t.completed
              ? "bg-positive/12 text-positive"
              : "border border-black/8 bg-white/70 text-ink-soft hover:bg-white",
          )}
        >
          <Check className="h-4 w-4" />
          {t.completed ? "Realizado" : "Marcar como realizado"}
        </button>
      </form>

      {t.completed && evaluation ? <EvalRow e={evaluation} /> : null}
    </div>
  );
}

export default async function TrainingPage() {
  const session = await getSession();
  const all = session ? await listTrainings(session.userId) : [];
  const evals = session
    ? await getTrainingEvaluations(session.userId)
    : new Map<number, TrainingEval>();
  const recommended = all.filter((t) => t.source === "ai");
  const mine = all.filter((t) => t.source === "self");

  return (
    <>
      <PageHeader
        title="Entrenamientos"
        subtitle="Registra tus sesiones y sigue los ejercicios que te recomienda el Coach IA."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-soft">Recomendados por la IA</h2>
          <Badge tone="accent">
            <Sparkles className="h-3 w-3" /> IA
          </Badge>
        </div>
        {recommended.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Aún no hay recomendaciones"
            description="Habla con el Coach IA y, cuando te proponga ejercicios, añádelos con un clic. Aparecerán aquí para marcarlos como realizados."
            action={
              <Link href="/coach" className="btn-primary">
                Hablar con el Coach
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recommended.map((t) => (
              <TrainingCard key={t.id} t={t} evaluation={evals.get(t.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-soft">Mis entrenamientos</h2>

        {mine.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Sin entrenamientos propios todavía"
            description="Anota tus sesiones para llevar el control de lo que trabajas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((t) => (
              <TrainingCard key={t.id} t={t} evaluation={evals.get(t.id)} />
            ))}
          </div>
        )}

        <form action={addTrainingAction} className="glass space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" />
            <h3 className="font-semibold">Nuevo entrenamiento</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Título *</span>
              <input name="title" required placeholder="Ej. Putts cortos" className="field" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Categoría</span>
              <select name="category" defaultValue="putting" className="field">
                <option value="driving">Salida</option>
                <option value="approach">Aproximación</option>
                <option value="short_game">Juego corto</option>
                <option value="putting">Putt</option>
                <option value="mental">Mental</option>
                <option value="fitness">Físico</option>
                <option value="other">Otro</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">¿Para qué? (objetivo)</span>
            <input name="goal" placeholder="Ej. Reducir los 3-putts" className="field" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Descripción</span>
            <textarea
              name="description"
              rows={2}
              placeholder="En qué consiste la sesión…"
              className="field"
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Duración (min)</span>
              <input name="durationMinutes" type="number" min={0} className="field w-32" />
            </label>
            <button type="submit" className="btn-primary mt-6">
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
