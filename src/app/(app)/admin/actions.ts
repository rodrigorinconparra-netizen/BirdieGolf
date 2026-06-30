"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, courses } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "superadmin") return null;
  return session;
}

async function superadminCount(): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(users)
    .where(eq(users.role, "superadmin"));
  return row?.c ?? 0;
}

export async function changeUserRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = Number(formData.get("id"));
  const role = String(formData.get("role"));
  if (!id || (role !== "player" && role !== "superadmin")) return;
  if (id === admin.userId) return; // don't change your own role

  if (role === "player") {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id));
    if (target?.role === "superadmin" && (await superadminCount()) <= 1) return; // keep one admin
  }

  await db.update(users).set({ role }).where(eq(users.id, id));
  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = Number(formData.get("id"));
  if (!id || id === admin.userId) return; // can't delete yourself

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  if (!target) return;
  if (target.role === "superadmin" && (await superadminCount()) <= 1) return;

  // Courses reference the creator (no cascade) → detach before deleting the user.
  await db.update(courses).set({ createdBy: null }).where(eq(courses.createdBy, id));
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin");
}
