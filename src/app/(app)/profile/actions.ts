"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clubs, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import type { ClubKind } from "@/lib/bag";
import { fetchFederatedHandicap } from "@/lib/federation";

const KINDS: ClubKind[] = ["wood", "hybrid", "iron", "wedge", "putter"];

export async function addClubAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const kindRaw = String(formData.get("kind") ?? "iron");
  const kind: ClubKind = KINDS.includes(kindRaw as ClubKind)
    ? (kindRaw as ClubKind)
    : "iron";

  const last = await db
    .select({ position: clubs.position })
    .from(clubs)
    .where(eq(clubs.userId, session.userId))
    .orderBy(desc(clubs.position))
    .limit(1);
  const position = (last[0]?.position ?? -1) + 1;

  await db.insert(clubs).values({ userId: session.userId, name, kind, position });
  revalidatePath("/profile");
}

export async function deleteClubAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(clubs).where(and(eq(clubs.id, id), eq(clubs.userId, session.userId)));
  revalidatePath("/profile");
}

export async function updateHandicapAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const raw = String(formData.get("handicap") ?? "").replace(",", ".").trim();
  const num = raw === "" ? null : Number(raw);
  await db
    .update(users)
    .set({ handicap: num != null && Number.isFinite(num) ? num : null })
    .where(eq(users.id, session.userId));
  revalidatePath("/profile");
}

export interface FederationState {
  ok?: boolean;
  error?: string;
  saved?: boolean;
  name?: string;
  handicapLabel?: string;
  worldHandicapLabel?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  handicap?: number | null;
}

/** Look up the federated handicap by license and, if found, save it to the profile. */
export async function syncFederatedHandicapAction(
  _prev: FederationState,
  formData: FormData,
): Promise<FederationState> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const license = String(formData.get("license") ?? "").trim();
  if (!license) return { error: "Introduce tu número de licencia." };

  const r = await fetchFederatedHandicap(license);
  if (!r.ok) return { error: r.error };

  const d = r.data;
  await db
    .update(users)
    .set({
      federationLicense: license,
      ...(d.handicap != null ? { handicap: d.handicap } : {}),
    })
    .where(eq(users.id, session.userId));
  revalidatePath("/profile");

  return {
    ok: true,
    saved: d.handicap != null,
    name: d.name,
    handicapLabel: d.handicapLabel,
    worldHandicapLabel: d.worldHandicapLabel,
    status: d.status,
    updatedAt: d.updatedAt,
    handicap: d.handicap,
  };
}
