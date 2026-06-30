import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trainings } from "@/lib/db/schema";

export async function listTrainings(userId: number) {
  return db
    .select()
    .from(trainings)
    .where(eq(trainings.userId, userId))
    .orderBy(desc(trainings.createdAt));
}
