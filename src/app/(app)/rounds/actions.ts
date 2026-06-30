"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rounds, roundHoles, holes as courseHoles, courseTees } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { notifyFollowersRoundCreated } from "@/lib/social";
import { addPartnersToRound, savePartnerHole } from "@/lib/round-players";

/** Direction / miss values shared by fairway, approach and putt. */
export type FairwayValue = "hit" | "left" | "right" | "short" | "long" | null;

export interface RoundHoleData {
  par: number | null;
  strokes: number | null;
  putts: number | null;
  penalties: number;
  fairway: FairwayValue;
  teeClub: string | null;
  teeDistanceMeters: number | null;
  approachClub: string | null;
  approachDistanceMeters: number | null;
  approachResult: FairwayValue;
  sand: boolean | null;
  firstPuttDistanceMeters: number | null;
  puttResult: FairwayValue;
}

/** Start a new round on a course; seed its holes from the course. */
export async function createRoundAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const courseId = Number(formData.get("courseId"));
  if (!courseId) redirect("/rounds/new");

  const dateStr = String(formData.get("playedAt") ?? "");
  const playedAt = dateStr ? new Date(dateStr) : new Date();

  // Tee selected from the course's tees (dropdown); resolve its name for display.
  const teeId = Number(formData.get("teeId")) || null;
  let tee = String(formData.get("tee") ?? "").trim() || null;
  if (teeId) {
    const [t] = await db
      .select({ name: courseTees.name, courseId: courseTees.courseId })
      .from(courseTees)
      .where(eq(courseTees.id, teeId));
    if (t && t.courseId === courseId) tee = t.name;
  }

  // "now" → live round (notify followers on creation); "past" → already played
  // (notify once all holes are filled). Default to "now".
  const live = formData.get("mode") !== "past";

  const ch = await db
    .select()
    .from(courseHoles)
    .where(eq(courseHoles.courseId, courseId))
    .orderBy(courseHoles.number);

  const [round] = await db
    .insert(rounds)
    .values({
      userId: session.userId,
      courseId,
      playedAt,
      tee,
      teeId: teeId ?? undefined,
      notified: live,
    })
    .returning();

  const seed =
    ch.length > 0
      ? ch.map((h) => ({ roundId: round.id, holeNumber: h.number, par: h.par }))
      : Array.from({ length: 18 }, (_, i) => ({
          roundId: round.id,
          holeNumber: i + 1,
          par: 4,
        }));
  await db.insert(roundHoles).values(seed);

  // Playing partners: each gets their own round (seeded the same), into which we
  // record their per-hole totals; their followers are notified too.
  const partnerIds = String(formData.get("partners") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (partnerIds.length > 0) {
    await addPartnersToRound({
      creatorRoundId: round.id,
      creatorUserId: session.userId,
      partnerUserIds: partnerIds,
      courseId,
      playedAt,
      tee,
      teeId: teeId ?? null,
      live,
    });
  }

  if (live) {
    await notifyFollowersRoundCreated(session.userId, round.id);
  }

  revalidatePath("/rounds");
  redirect(`/rounds/${round.id}`);
}

/** Record a playing partner's total strokes on one hole (creator only). */
export async function savePartnerHoleAction(
  roundId: number,
  partnerUserId: number,
  holeNumber: number,
  strokes: number | null,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  const res = await savePartnerHole(
    session.userId,
    roundId,
    partnerUserId,
    holeNumber,
    strokes,
  );
  if (res.ok) revalidatePath(`/rounds/${roundId}`);
  return res;
}

/** Save one hole and recompute the round totals. */
export async function saveRoundHoleAction(
  roundId: number,
  holeNumber: number,
  data: RoundHoleData,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const [owned] = await db
    .select({ id: rounds.id, notified: rounds.notified })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.userId)));
  if (!owned) return { error: "Vuelta no encontrada" };

  // Green in regulation is derived, not asked: on the green in (par − 2) strokes.
  const greenInRegulation =
    data.strokes != null && data.putts != null && data.par != null
      ? data.strokes - data.putts <= data.par - 2
      : null;

  await db
    .update(roundHoles)
    .set({
      strokes: data.strokes,
      putts: data.putts,
      penalties: data.penalties ?? 0,
      fairway: data.fairway,
      teeClub: data.teeClub,
      teeDistanceMeters: data.teeDistanceMeters,
      approachClub: data.approachClub,
      approachDistanceMeters: data.approachDistanceMeters,
      approachResult: data.approachResult,
      sand: data.sand,
      firstPuttDistanceMeters: data.firstPuttDistanceMeters,
      puttResult: data.puttResult,
      greenInRegulation,
    })
    .where(and(eq(roundHoles.roundId, roundId), eq(roundHoles.holeNumber, holeNumber)));

  const all = await db
    .select({ strokes: roundHoles.strokes, putts: roundHoles.putts })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId));
  const totalStrokes = all.reduce((s, h) => s + (h.strokes ?? 0), 0) || null;
  const totalPutts = all.reduce((s, h) => s + (h.putts ?? 0), 0) || null;
  await db.update(rounds).set({ totalStrokes, totalPutts }).where(eq(rounds.id, roundId));

  // A past round notifies followers once every hole has been filled in.
  if (!owned.notified && all.length > 0 && all.every((h) => h.strokes != null)) {
    await db.update(rounds).set({ notified: true }).where(eq(rounds.id, roundId));
    await notifyFollowersRoundCreated(session.userId, roundId);
  }

  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/rounds");
  return { ok: true };
}

/** Change the course a round is associated with (e.g. wrong course was picked). */
export async function changeRoundCourseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const roundId = Number(formData.get("roundId"));
  const courseId = Number(formData.get("courseId")) || null;
  if (!roundId) return;

  const [owned] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.userId, session.userId)));
  if (!owned) return;

  // The tee (barra) belongs to the old course, so it no longer applies.
  await db
    .update(rounds)
    .set({ courseId, teeId: null, tee: null })
    .where(eq(rounds.id, roundId));

  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/rounds");
  redirect(`/rounds/${roundId}`);
}

export async function deleteRoundAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(rounds).where(and(eq(rounds.id, id), eq(rounds.userId, session.userId)));
  revalidatePath("/rounds");
  redirect("/rounds");
}
