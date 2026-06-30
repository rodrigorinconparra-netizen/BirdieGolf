import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs } from "@/lib/db/schema";

export type ClubKind = "wood" | "hybrid" | "iron" | "wedge" | "putter";

export const CLUB_KIND_LABEL: Record<ClubKind, string> = {
  wood: "Madera",
  hybrid: "Híbrido",
  iron: "Hierro",
  wedge: "Wedge",
  putter: "Putter",
};

/** A sensible default amateur bag, created for every new user. */
export const DEFAULT_BAG: { name: string; kind: ClubKind }[] = [
  { name: "Driver", kind: "wood" },
  { name: "Madera 3", kind: "wood" },
  { name: "Madera 5", kind: "wood" },
  { name: "Híbrido 4", kind: "hybrid" },
  { name: "Hierro 5", kind: "iron" },
  { name: "Hierro 6", kind: "iron" },
  { name: "Hierro 7", kind: "iron" },
  { name: "Hierro 8", kind: "iron" },
  { name: "Hierro 9", kind: "iron" },
  { name: "Pitching Wedge", kind: "wedge" },
  { name: "Gap Wedge", kind: "wedge" },
  { name: "Sand Wedge", kind: "wedge" },
  { name: "Putter", kind: "putter" },
];

export async function createDefaultBag(userId: number): Promise<void> {
  await db.insert(clubs).values(
    DEFAULT_BAG.map((c, i) => ({ userId, name: c.name, kind: c.kind, position: i })),
  );
}

export async function getBag(userId: number) {
  return db
    .select()
    .from(clubs)
    .where(eq(clubs.userId, userId))
    .orderBy(asc(clubs.position), asc(clubs.id));
}
