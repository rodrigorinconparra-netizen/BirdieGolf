import { and, asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chatMessages, rounds, courses } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { CoachChat } from "@/components/coach-chat";

export const dynamic = "force-dynamic";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; round?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;

  const rows = session
    ? await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.userId, session.userId))
        .orderBy(asc(chatMessages.createdAt))
    : [];

  const initialMessages = rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));

  const focusRoundId = sp.round ? Number(sp.round) : null;

  // Build a label for the focused round (scoped to the user) so the chat can show
  // exactly which round it's analyzing.
  let focusLabel: string | null = null;
  if (session && focusRoundId) {
    const [r] = await db
      .select({
        playedAt: rounds.playedAt,
        totalStrokes: rounds.totalStrokes,
        courseName: courses.name,
      })
      .from(rounds)
      .leftJoin(courses, eq(rounds.courseId, courses.id))
      .where(and(eq(rounds.id, focusRoundId), eq(rounds.userId, session.userId)));
    if (r) {
      const fecha = new Date(r.playedAt).toLocaleDateString("es-ES");
      focusLabel = `vuelta del ${fecha} en ${r.courseName ?? "el campo"}${
        r.totalStrokes != null ? ` (${r.totalStrokes} golpes)` : ""
      }`;
    }
  }

  return (
    <>
      <PageHeader
        title="Coach IA"
        subtitle="Tu entrenador analiza tu juego y te dice qué mejorar."
      />
      <CoachChat
        initialMessages={initialMessages}
        startPrompt={sp.start ?? null}
        focusRoundId={focusRoundId}
        focusLabel={focusLabel}
      />
    </>
  );
}
