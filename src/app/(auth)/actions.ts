"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { createDefaultBag } from "@/lib/bag";

export interface AuthState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Tu nombre es muy corto"),
  email: z.string().email("Email no válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/dashboard");
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const { email, password } = parsed.data;
  const name = parsed.data.name.trim();
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail));
  if (existing) {
    return { error: "Ya existe una cuenta con ese email" };
  }

  // The display name is also unique (case-insensitive).
  const [nameTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.name}) = ${name.toLowerCase()}`);
  if (nameTaken) {
    return { error: "Ese nombre de usuario ya está en uso" };
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ name, email: normalizedEmail, passwordHash, role: "player" })
    .returning();

  await createDefaultBag(user.id);

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
