"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { courses, holes, courseTees, teeHoleDistances } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  searchCourses,
  getCourse,
  type CourseSearchResult,
} from "@/lib/golf-course-api";
import {
  searchOsmCourses,
  getOsmCoursePrefill,
  type OsmSearchResult,
  type OsmCoursePrefill,
  type OsmType,
} from "@/lib/osm-courses";
import { externalCourseExists } from "@/lib/courses";

export interface CourseFormState {
  error?: string;
}

/** Returns the session only if the user is a superadmin (course management is admin-only). */
async function requireAdminSession() {
  const session = await getSession();
  return session && session.role === "superadmin" ? session : null;
}

function readString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

/** Create a course manually, with its holes. */
export async function createManualCourse(
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const session = await requireAdminSession();
  if (!session) return { error: "No autenticado" };

  const name = readString(formData, "name");
  if (!name || name.length < 2) {
    return { error: "El nombre del campo es obligatorio" };
  }

  const holesCount = Number(formData.get("holesCount")) === 9 ? 9 : 18;
  const holeRows: {
    number: number;
    par: number;
    distanceMeters: number | null;
    strokeIndex: number | null;
  }[] = [];
  let parTotal = 0;

  for (let i = 1; i <= holesCount; i++) {
    const par = Number(formData.get(`par_${i}`)) || 4;
    const distRaw = formData.get(`dist_${i}`);
    const siRaw = formData.get(`si_${i}`);
    parTotal += par;
    holeRows.push({
      number: i,
      par,
      distanceMeters: distRaw ? Number(distRaw) || null : null,
      strokeIndex: siRaw ? Number(siRaw) || null : null,
    });
  }

  const [course] = await db
    .insert(courses)
    .values({
      name,
      city: readString(formData, "city"),
      region: readString(formData, "region"),
      country: readString(formData, "country"),
      holesCount,
      par: parTotal,
      source: "manual",
      createdBy: session.userId,
    })
    .returning();

  await db.insert(holes).values(holeRows.map((h) => ({ ...h, courseId: course.id })));
  await ensureStandardTees(course.id);

  revalidatePath("/courses");
  redirect(`/courses/${course.id}`);
}

/** Update an existing course and replace its holes. */
export async function updateCourse(
  courseId: number,
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const session = await requireAdminSession();
  if (!session) return { error: "No autenticado" };

  const name = readString(formData, "name");
  if (!name || name.length < 2) {
    return { error: "El nombre del campo es obligatorio" };
  }

  const holesCount = Number(formData.get("holesCount")) === 9 ? 9 : 18;
  const holeRows: {
    number: number;
    par: number;
    distanceMeters: number | null;
    strokeIndex: number | null;
  }[] = [];
  let parTotal = 0;

  for (let i = 1; i <= holesCount; i++) {
    const par = Number(formData.get(`par_${i}`)) || 4;
    const distRaw = formData.get(`dist_${i}`);
    const siRaw = formData.get(`si_${i}`);
    parTotal += par;
    holeRows.push({
      number: i,
      par,
      distanceMeters: distRaw ? Number(distRaw) || null : null,
      strokeIndex: siRaw ? Number(siRaw) || null : null,
    });
  }

  await db
    .update(courses)
    .set({
      name,
      city: readString(formData, "city"),
      region: readString(formData, "region"),
      country: readString(formData, "country"),
      holesCount,
      par: parTotal,
    })
    .where(eq(courses.id, courseId));

  await db.delete(holes).where(eq(holes.courseId, courseId));
  await db.insert(holes).values(holeRows.map((h) => ({ ...h, courseId })));

  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

/** Search the public API (called imperatively from the client). */
export async function searchExternalCoursesAction(
  query: string,
): Promise<{ results?: CourseSearchResult[]; error?: string }> {
  if (!query || query.trim().length < 2) return { results: [] };
  try {
    const results = await searchCourses(query.trim());
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en la búsqueda" };
  }
}

/** Import a course from the public API into the DB. */
export async function importCourse(
  externalId: string,
): Promise<{ courseId?: number; error?: string }> {
  const session = await requireAdminSession();
  if (!session) return { error: "No autenticado" };

  const existingId = await externalCourseExists(externalId);
  if (existingId) return { courseId: existingId };

  let normalized;
  try {
    normalized = await getCourse(externalId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al importar" };
  }

  const [course] = await db
    .insert(courses)
    .values({
      name: normalized.name,
      city: normalized.city,
      region: normalized.region,
      country: normalized.country,
      holesCount: normalized.holesCount,
      par: normalized.par ?? null,
      source: "api",
      externalId: normalized.externalId,
      createdBy: session.userId,
    })
    .returning();

  if (normalized.holes.length) {
    await db.insert(holes).values(
      normalized.holes.map((h) => ({
        courseId: course.id,
        number: h.number,
        par: h.par,
        distanceMeters: h.distanceMeters,
        strokeIndex: h.strokeIndex,
      })),
    );
  }
  await ensureStandardTees(course.id);

  revalidatePath("/courses");
  return { courseId: course.id };
}

/** Search golf courses on OpenStreetMap (good Spain/worldwide coverage). */
export async function searchOsmCoursesAction(
  query: string,
): Promise<{ results?: OsmSearchResult[]; error?: string }> {
  if (!query || query.trim().length < 2) return { results: [] };
  try {
    const results = await searchOsmCourses(query.trim());
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en la búsqueda" };
  }
}

/** Fetch a course's data from OSM to pre-fill the form (user confirms it). */
export async function getOsmPrefillAction(
  osmType: OsmType,
  osmId: number,
): Promise<{ prefill?: OsmCoursePrefill; error?: string }> {
  try {
    const prefill = await getOsmCoursePrefill(osmType, osmId);
    return { prefill };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cargar el campo" };
  }
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(courses).where(eq(courses.id, id));
  revalidatePath("/courses");
  redirect("/courses");
}

/* ---- Tees ("barras de salida") management (admin) ---- */

/** Standard Spanish tees: Amarillas (men) and Rojas (women). */
const STANDARD_TEES = [
  { name: "Amarillas", color: "#facc15", gender: "men" as const },
  { name: "Rojas", color: "#ef4444", gender: "women" as const },
];

/** Creates the standard Amarillas/Rojas tees for a course if missing (empty, ready to fill). */
export async function ensureStandardTees(courseId: number): Promise<void> {
  const existing = await db
    .select({ name: courseTees.name })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId));
  const names = new Set(existing.map((e) => e.name.toLowerCase()));
  const toCreate = STANDARD_TEES.filter((t) => !names.has(t.name.toLowerCase()));
  if (toCreate.length === 0) return;

  const [last] = await db
    .select({ position: courseTees.position })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(desc(courseTees.position))
    .limit(1);
  let pos = (last?.position ?? -1) + 1;
  await db.insert(courseTees).values(
    toCreate.map((t) => ({
      courseId,
      name: t.name,
      color: t.color,
      gender: t.gender,
      position: pos++,
    })),
  );
}

/** Admin: add the standard Amarillas/Rojas tees to a course. */
export async function addStandardTeesAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  const courseId = Number(formData.get("courseId"));
  if (!courseId) return;
  await ensureStandardTees(courseId);
  revalidatePath(`/courses/${courseId}/tees`);
  revalidatePath(`/courses/${courseId}`);
}

function readGender(fd: FormData): "men" | "women" | "any" {
  const v = fd.get("gender");
  return v === "men" || v === "women" ? v : "any";
}

/** Add a new tee box to a course. */
export async function addTeeAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  const courseId = Number(formData.get("courseId"));
  const name = readString(formData, "name");
  if (!courseId || !name) return;

  const [last] = await db
    .select({ position: courseTees.position })
    .from(courseTees)
    .where(eq(courseTees.courseId, courseId))
    .orderBy(desc(courseTees.position))
    .limit(1);

  await db.insert(courseTees).values({
    courseId,
    name,
    color: readString(formData, "color"),
    gender: readGender(formData),
    courseRating: formData.get("courseRating") ? Number(formData.get("courseRating")) || null : null,
    slopeRating: formData.get("slopeRating") ? Number(formData.get("slopeRating")) || null : null,
    position: (last?.position ?? -1) + 1,
  });
  revalidatePath(`/courses/${courseId}/tees`);
  revalidatePath(`/courses/${courseId}`);
}

/** Update a tee's metadata and its per-hole distances in one save. */
export async function updateTeeAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  const teeId = Number(formData.get("teeId"));
  const courseId = Number(formData.get("courseId"));
  const holesCount = Number(formData.get("holesCount")) === 9 ? 9 : 18;
  const name = readString(formData, "name");
  if (!teeId || !courseId || !name) return;

  // The tee must belong to the course (guard against tampering).
  const [tee] = await db
    .select({ id: courseTees.id })
    .from(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, courseId)));
  if (!tee) return;

  await db
    .update(courseTees)
    .set({
      name,
      color: readString(formData, "color"),
      gender: readGender(formData),
      courseRating: formData.get("courseRating")
        ? Number(formData.get("courseRating")) || null
        : null,
      slopeRating: formData.get("slopeRating") ? Number(formData.get("slopeRating")) || null : null,
    })
    .where(eq(courseTees.id, teeId));

  for (let i = 1; i <= holesCount; i++) {
    const raw = formData.get(`m_${i}`);
    const meters = raw != null && String(raw).trim() !== "" ? Number(raw) || null : null;
    await db
      .insert(teeHoleDistances)
      .values({ teeId, holeNumber: i, meters })
      .onConflictDoUpdate({
        target: [teeHoleDistances.teeId, teeHoleDistances.holeNumber],
        set: { meters },
      });
  }

  revalidatePath(`/courses/${courseId}/tees`);
  revalidatePath(`/courses/${courseId}`);
}

/** Delete a tee box (and its distances). */
export async function deleteTeeAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!session) return;
  const teeId = Number(formData.get("teeId"));
  const courseId = Number(formData.get("courseId"));
  if (!teeId || !courseId) return;
  await db
    .delete(courseTees)
    .where(and(eq(courseTees.id, teeId), eq(courseTees.courseId, courseId)));
  revalidatePath(`/courses/${courseId}/tees`);
  revalidatePath(`/courses/${courseId}`);
}
