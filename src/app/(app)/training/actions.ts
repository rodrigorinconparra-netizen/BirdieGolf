"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { trainings } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { normalizeCategory } from "@/lib/training-meta";

/** Create a training the user logs themselves. */
export async function addTrainingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const category = normalizeCategory(String(formData.get("category") ?? "other"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const goal = String(formData.get("goal") ?? "").trim() || null;
  const durRaw = formData.get("durationMinutes");
  const durationMinutes = durRaw ? Number(durRaw) || null : null;

  await db.insert(trainings).values({
    userId: session.userId,
    title,
    category,
    description,
    goal,
    durationMinutes,
    source: "self",
    completed: false,
  });
  revalidatePath("/training");
}

/** Add a training recommended by the Coach (called from the chat). */
export async function addRecommendedTrainingAction(input: {
  title: string;
  category: string;
  description?: string;
  goal?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const title = input.title?.trim();
  if (!title) return { error: "Sin título" };

  await db.insert(trainings).values({
    userId: session.userId,
    title,
    category: normalizeCategory(input.category),
    description: input.description?.trim() || null,
    goal: input.goal?.trim() || null,
    source: "ai",
    completed: false,
  });
  revalidatePath("/training");
  return { ok: true };
}

export async function toggleTrainingCompletedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const currentlyDone = String(formData.get("completed")) === "true";
  await db
    .update(trainings)
    .set({ completed: !currentlyDone, performedAt: !currentlyDone ? new Date() : null })
    .where(and(eq(trainings.id, id), eq(trainings.userId, session.userId)));
  revalidatePath("/training");
}

export async function deleteTrainingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(trainings).where(and(eq(trainings.id, id), eq(trainings.userId, session.userId)));
  revalidatePath("/training");
}
