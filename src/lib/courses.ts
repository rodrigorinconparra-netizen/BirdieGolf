import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, holes } from "@/lib/db/schema";

export async function listCourses() {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      city: courses.city,
      region: courses.region,
      country: courses.country,
      holesCount: courses.holesCount,
      par: courses.par,
      source: courses.source,
    })
    .from(courses)
    .orderBy(desc(courses.createdAt));
}

export async function getCourseWithHoles(id: number) {
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) return null;
  const courseHoles = await db
    .select()
    .from(holes)
    .where(eq(holes.courseId, id))
    .orderBy(holes.number);
  return { course, holes: courseHoles };
}

/** Returns the internal id if a course with this external id was already imported. */
export async function externalCourseExists(externalId: string) {
  const [row] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.externalId, externalId));
  return row?.id ?? null;
}
