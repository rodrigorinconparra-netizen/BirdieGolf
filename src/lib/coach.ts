import "server-only";
import Groq from "groq-sdk";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rounds, roundHoles, courses, clubs, users, trainings } from "@/lib/db/schema";
import { buildRoundSummary } from "@/lib/round-analysis";
import { getTrainingEvaluations } from "@/lib/training-eval";
import { getStrokesGainedAverage } from "@/lib/strokes-gained";

const MODEL = "llama-3.3-70b-versatile";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

/** Builds the player context (profile + bag + recent rounds + focused round). */
export async function buildCoachContext(
  userId: number,
  focusRoundId?: number,
): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const bag = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.userId, userId))
    .orderBy(clubs.position);

  const recent = await db
    .select({
      id: rounds.id,
      playedAt: rounds.playedAt,
      totalStrokes: rounds.totalStrokes,
      totalPutts: rounds.totalPutts,
      courseName: courses.name,
      coursePar: courses.par,
    })
    .from(rounds)
    .leftJoin(courses, eq(rounds.courseId, courses.id))
    .where(eq(rounds.userId, userId))
    .orderBy(desc(rounds.playedAt))
    .limit(6);

  // Plus handicaps (better than scratch) are stored as negatives → show as "+X".
  const fmtHcp = (h: number) => (h < 0 ? `+${Math.abs(h)}` : `${h}`);

  const lines: string[] = [];
  lines.push(
    `Jugador: ${user?.name ?? "—"}${user?.handicap != null ? `, hándicap ${fmtHcp(user.handicap)}` : ""}.`,
  );
  if (user?.handicap != null) {
    lines.push(
      `Nivel del jugador: hándicap ${fmtHcp(user.handicap)}. Calibra TUS críticas, expectativas y la dificultad de los entrenamientos al nivel propio de ese hándicap.`,
    );
  } else {
    lines.push(
      "El jugador no tiene hándicap registrado: no lo tengas en cuenta ni lo menciones; básate solo en sus vueltas.",
    );
  }
  lines.push(`Bolsa: ${bag.map((b) => b.name).join(", ") || "—"}.`);

  if (recent.length) {
    lines.push("Últimas vueltas:");
    for (const r of recent) {
      const vs =
        r.totalStrokes != null && r.coursePar != null ? r.totalStrokes - r.coursePar : null;
      lines.push(
        `- ${new Date(r.playedAt).toLocaleDateString("es-ES")} · ${r.courseName ?? "Campo"} · ${r.totalStrokes ?? "?"} golpes${vs != null ? ` (${vs >= 0 ? "+" : ""}${vs})` : ""} · ${r.totalPutts ?? "?"} putts`,
      );
    }
  } else {
    lines.push("El jugador aún no ha registrado vueltas.");
  }

  // Strokes Gained (media por vuelta, estimación) → para localizar el área que más cuesta.
  const sg = await getStrokesGainedAverage(userId);
  if (sg.totalHoles > 0) {
    const f = (v: number) => (v >= 0 ? "+" : "") + (Math.round(v * 10) / 10).toFixed(1);
    lines.push("");
    lines.push(
      `Strokes Gained medio por vuelta (estimación${sg.net ? ", calibrado a SU hándicap: 0 = juega a su nivel, positivo = mejor" : " vs scratch"}; negativo = pierde): Total ${f(sg.total)}.`,
    );
    if (sg.detailHoles > 0) {
      lines.push(
        `  Desglose: Salida ${f(sg.tee)}, Juego a green (approach+corto) ${f(sg.approach)}, Putt ${f(sg.putting)}. El más negativo es donde más pierde: prioriza entrenar ahí.`,
      );
    }
  }

  const tr = await db
    .select({
      id: trainings.id,
      title: trainings.title,
      category: trainings.category,
      goal: trainings.goal,
      source: trainings.source,
      completed: trainings.completed,
    })
    .from(trainings)
    .where(eq(trainings.userId, userId))
    .orderBy(desc(trainings.createdAt))
    .limit(12);
  if (tr.length) {
    lines.push("");
    lines.push("Entrenamientos del jugador:");
    for (const t of tr) {
      lines.push(
        `- [${t.completed ? "hecho" : "pendiente"}] (${t.category}) ${t.title}${t.goal ? ` — objetivo: ${t.goal}` : ""} [${t.source === "ai" ? "recomendado por ti" : "propio"}]`,
      );
    }

    const titleById = new Map(tr.map((t) => [t.id, t.title]));
    const evals = [...(await getTrainingEvaluations(userId)).values()].filter(
      (e) => e.before != null && e.after != null,
    );
    if (evals.length) {
      lines.push("");
      lines.push("Impacto medido de los entrenamientos completados (media antes → después):");
      for (const e of evals) {
        const word =
          e.status === "improved" ? "mejoró" : e.status === "worse" ? "empeoró" : "sin cambios";
        lines.push(
          `- "${titleById.get(e.trainingId) ?? e.metricLabel}": ${e.metricLabel} ${e.before!.toFixed(1)} → ${e.after!.toFixed(1)}${e.unit} (${word}, ${e.beforeRounds} vs ${e.afterRounds} vueltas)`,
        );
      }
    }
  }

  // The user can arrive from a specific round (explicit focus). Otherwise we
  // default to the most recent round, but make clear it's only a default.
  const explicitFocus = focusRoundId != null;
  const focusId = focusRoundId ?? recent[0]?.id ?? null;
  if (focusId) {
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.id, focusId), eq(rounds.userId, userId)));
    if (round) {
      const course = round.courseId
        ? ((await db.select().from(courses).where(eq(courses.id, round.courseId)))[0] ?? null)
        : null;
      const holes = await db
        .select()
        .from(roundHoles)
        .where(eq(roundHoles.roundId, focusId))
        .orderBy(roundHoles.holeNumber);
      const fecha = new Date(round.playedAt).toLocaleDateString("es-ES");
      const vs =
        round.totalStrokes != null && course?.par != null
          ? round.totalStrokes - course.par
          : null;
      const head = `Vuelta del ${fecha} en ${course?.name ?? "Campo"}${
        round.totalStrokes != null
          ? ` · ${round.totalStrokes} golpes${vs != null ? ` (${vs >= 0 ? "+" : ""}${vs})` : ""}`
          : ""
      } (id ${round.id}).`;
      lines.push("");
      if (explicitFocus) {
        lines.push(
          ">>> VUELTA EN FOCO — el usuario te pregunta EXACTAMENTE por esta vuelta. " +
            'Cuando diga "esta vuelta", "la vuelta" o "mi vuelta" se refiere a ESTA y no a ninguna otra de "Últimas vueltas".',
        );
      } else {
        lines.push("Vuelta en foco (por defecto, la más reciente):");
      }
      lines.push(head);
      lines.push(buildRoundSummary(course?.name ?? "Campo", holes));
    }
  }

  return lines.join("\n");
}

const COACH_SYSTEM = `Eres el Coach IA de una app de golf: un entrenador experto, cercano y motivador. Hablas en español de España. Tienes acceso a los datos reales del jugador (perfil, bolsa y vueltas) en el contexto.
- Da consejos concretos y accionables, citando los números reales del jugador.
- Adapta el NIVEL DE EXIGENCIA al hándicap del jugador cuando esté en el contexto: a hándicap bajo (≈≤9 o "+") exígele consistencia, estrategia y precisión, y márcale metas ambiciosas; a hándicap medio (≈10-18) prioriza reducir errores y fallos grandes; a hándicap alto (≈≥19) céntrate en lo básico (contacto, dirección, evitar dobles) y sé más indulgente y paciente. Ajusta tanto las críticas como la dificultad/metas de los entrenamientos a ese nivel. Si NO hay hándicap en el contexto, no lo menciones ni lo tengas en cuenta: básate solo en sus vueltas.
- Al analizar una vuelta: destaca lo que hizo bien, señala los puntos débiles y propón 1-3 cosas a entrenar.
- Si en el contexto hay una "VUELTA EN FOCO", es la vuelta de la que habla el usuario: cuando diga "esta vuelta", "la vuelta" o "mi vuelta", refiérete SIEMPRE a esa (identifícala por su fecha y campo) y NO la confundas con otras de "Últimas vueltas".
- Sé breve por defecto (máx ~200 palabras) salvo que pidan más detalle. Usa markdown con encabezados "##" y viñetas "-" cuando ayude.
- No inventes datos que no estén en el contexto. Si faltan datos, dilo.
- Si hay "Impacto medido de los entrenamientos", valora si cada entrenamiento le ha servido (mejoró/empeoró) citando los números antes→después; si aún no hay vueltas posteriores, dilo.
- Cuando propongas ejercicios concretos para entrenar, AÑADE AL FINAL de tu mensaje un bloque EXACTAMENTE con este formato (sin texto extra dentro):
<entrenamientos>
categoria | título corto | descripción breve del ejercicio | objetivo
</entrenamientos>
Una línea por ejercicio (entre 1 y 3). "categoria" debe ser una de: putting, juego_corto, driving, approach, mental, fitness. No incluyas el bloque si no recomiendas ejercicios.`;

export async function chatWithCoach(
  history: CoachMessage[],
  context: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no configurada");
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    max_tokens: 900,
    messages: [
      { role: "system", content: COACH_SYSTEM },
      { role: "system", content: "Contexto del jugador:\n" + context },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "…";
}
