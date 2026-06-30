import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseTees, teeHoleDistances } from "@/lib/db/schema";

export interface TeeWithDistances {
  id: number;
  courseId: number;
  name: string;
  color: string | null;
  gender: "men" | "women" | "any";
  courseRating: number | null;
  slopeRating: number | null;
  position: number;
  /** holeNumber -> meters */
  distances: Record<number, number | null>;
  totalMeters: number;
}

/** All tees of a course, ordered, each with its per-hole distances and total. */
export async function getCourseTees(courseId: number): Promise<TeeWithDistances[]> {
  const tees = await db
    .select()
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(asc(courseTees.position), asc(courseTees.id));
  if (tees.length === 0) return [];

  const dists = await db
    .select()
    .from(teeHoleDistances)
    .where(
      inArray(
        teeHoleDistances.teeId,
        tees.map((t) => t.id),
      ),
    );

  return tees.map((t) => {
    const distances: Record<number, number | null> = {};
    let total = 0;
    for (const d of dists) {
      if (d.teeId !== t.id) continue;
      distances[d.holeNumber] = d.meters;
      total += d.meters ?? 0;
    }
    return { ...t, distances, totalMeters: total };
  });
}

export interface TeeOption {
  id: number;
  courseId: number;
  name: string;
  color: string | null;
  gender: "men" | "women" | "any";
  totalMeters: number;
  courseRating: number | null;
  slopeRating: number | null;
}

/** Lightweight list of every tee (id, name, total metres) grouped by course — for the new-round dropdown. */
export async function getTeesByCourse(): Promise<Record<number, TeeOption[]>> {
  const tees = await db
    .select()
    .from(courseTees)
    .orderBy(asc(courseTees.courseId), asc(courseTees.position), asc(courseTees.id));
  if (tees.length === 0) return {};

  const dists = await db
    .select({ teeId: teeHoleDistances.teeId, meters: teeHoleDistances.meters })
    .from(teeHoleDistances);
  const totals = new Map<number, number>();
  for (const d of dists) totals.set(d.teeId, (totals.get(d.teeId) ?? 0) + (d.meters ?? 0));

  const byCourse: Record<number, TeeOption[]> = {};
  for (const t of tees) {
    (byCourse[t.courseId] ??= []).push({
      id: t.id,
      courseId: t.courseId,
      name: t.name,
      color: t.color,
      gender: t.gender,
      totalMeters: totals.get(t.id) ?? 0,
      courseRating: t.courseRating,
      slopeRating: t.slopeRating,
    });
  }
  return byCourse;
}
