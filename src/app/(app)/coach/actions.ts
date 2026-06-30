"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isGroqConfigured } from "@/lib/round-analysis";
import {
  buildCoachContext,
  chatWithCoach,
  type CoachMessage,
} from "@/lib/coach";

export async function sendCoachMessage(
  content: string,
  focusRoundId?: number,
): Promise<{ reply?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const text = content.trim();
  if (!text) return { error: "Escribe un mensaje" };
  if (!isGroqConfigured()) {
    return {
      error:
        "Configura tu GROQ_API_KEY en .env.local (https://console.groq.com/keys) para hablar con el Coach IA.",
    };
  }

  await db
    .insert(chatMessages)
    .values({ userId: session.userId, role: "user", content: text });

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, session.userId))
    .orderBy(asc(chatMessages.createdAt));
  const history: CoachMessage[] = rows
    .slice(-20)
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

  let reply: string;
  try {
    const context = await buildCoachContext(session.userId, focusRoundId);
    reply = await chatWithCoach(history, context);
  } catch (e) {
    return { error: e instanceof Error ? `Error de IA: ${e.message}` : "Error de IA" };
  }

  await db
    .insert(chatMessages)
    .values({ userId: session.userId, role: "assistant", content: reply });
  revalidatePath("/coach");
  return { reply };
}

export async function clearCoachAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await db.delete(chatMessages).where(eq(chatMessages.userId, session.userId));
  revalidatePath("/coach");
}
