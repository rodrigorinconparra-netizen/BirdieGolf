import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, rounds, courses } from "@/lib/db/schema";

export async function getAdminData() {
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      handicap: users.handicap,
      createdAt: users.createdAt,
      roundsCount: count(rounds.id),
    })
    .from(users)
    .leftJoin(rounds, eq(rounds.userId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.id));

  const [coursesRow] = await db.select({ c: count() }).from(courses);

  return {
    users: userRows,
    coursesCount: coursesRow?.c ?? 0,
    totalRounds: userRows.reduce((s, u) => s + u.roundsCount, 0),
    players: userRows.filter((u) => u.role === "player").length,
    admins: userRows.filter((u) => u.role === "superadmin").length,
  };
}
