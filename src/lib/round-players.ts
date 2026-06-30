import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  rounds,
  roundHoles,
  roundPlayers,
  holes as courseHoles,
  users,
  notifications,
} from "@/lib/db/schema";
import { notifyFollowersRoundCreated } from "@/lib/social";
import { sendPushToUsers } from "@/lib/push";

export interface RoundPartner {
  /** round_players row id */
  id: number;
  userId: number;
  name: string;
  /** The partner's own round (in their account). */
  partnerRoundId: number | null;
  /** Total strokes the creator has recorded for the partner, per hole number. */
  strokesByHole: Record<number, number | null>;
}

/**
 * Create a real round in each partner's account for a round, seeded with the
 * same holes, and link it back to the creator's round. The creator records the
 * partners' per-hole totals into these rounds; partners can later edit/add
 * detail and it stays in their own "Mis Vueltas".
 */
export async function addPartnersToRound(opts: {
  creatorRoundId: number;
  creatorUserId: number;
  partnerUserIds: number[];
  courseId: number | null;
  playedAt: Date;
  tee: string | null;
  teeId: number | null;
  live: boolean;
}): Promise<void> {
  const ids = [...new Set(opts.partnerUserIds)].filter(
    (id) => Number.isFinite(id) && id !== opts.creatorUserId,
  );
  if (ids.length === 0) return;

  // Only real, existing users (and dedupe against anyone already linked).
  const existing = await db
    .select({ name: users.id })
    .from(users)
    .where(inArray(users.id, ids));
  const valid = new Set(existing.map((u) => u.name));

  const seedHoles =
    opts.courseId != null
      ? await db
          .select({ number: courseHoles.number, par: courseHoles.par })
          .from(courseHoles)
          .where(eq(courseHoles.courseId, opts.courseId))
          .orderBy(courseHoles.number)
      : [];

  const [creator] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, opts.creatorUserId));
  const creatorName = creator?.name ?? "Alguien";

  for (const partnerId of ids) {
    if (!valid.has(partnerId)) continue;

    const [partnerRound] = await db
      .insert(rounds)
      .values({
        userId: partnerId,
        courseId: opts.courseId ?? undefined,
        playedAt: opts.playedAt,
        tee: opts.tee,
        teeId: opts.teeId ?? undefined,
        notes: `Vuelta con ${creatorName}`,
        notified: opts.live,
      })
      .returning();

    const seed =
      seedHoles.length > 0
        ? seedHoles.map((h) => ({
            roundId: partnerRound.id,
            holeNumber: h.number,
            par: h.par,
          }))
        : Array.from({ length: 18 }, (_, i) => ({
            roundId: partnerRound.id,
            holeNumber: i + 1,
            par: 4,
          }));
    await db.insert(roundHoles).values(seed);

    await db
      .insert(roundPlayers)
      .values({
        roundId: opts.creatorRoundId,
        userId: partnerId,
        partnerRoundId: partnerRound.id,
      })
      .onConflictDoNothing();

    // Tell the partner they were added so they can mark themselves.
    await db.insert(notifications).values({
      userId: partnerId,
      actorId: opts.creatorUserId,
      roundId: partnerRound.id,
      type: "added_to_round",
    });
    await sendPushToUsers([partnerId], {
      title: "Birdie",
      body: `${creatorName} te ha añadido a una vuelta`,
      data: { type: "added_to_round", roundId: String(partnerRound.id) },
    });

    // A live round notifies the partner's own followers right away.
    if (opts.live) {
      await notifyFollowersRoundCreated(partnerId, partnerRound.id);
    }
  }
}

/** Partners linked to a round, with the totals recorded for each so far. */
export async function getRoundPartners(creatorRoundId: number): Promise<RoundPartner[]> {
  const rows = await db
    .select({
      id: roundPlayers.id,
      userId: roundPlayers.userId,
      name: users.name,
      partnerRoundId: roundPlayers.partnerRoundId,
    })
    .from(roundPlayers)
    .leftJoin(users, eq(roundPlayers.userId, users.id))
    .where(eq(roundPlayers.roundId, creatorRoundId));
  if (rows.length === 0) return [];

  const partnerRoundIds = rows
    .map((r) => r.partnerRoundId)
    .filter((x): x is number => x != null);
  const holeRows = partnerRoundIds.length
    ? await db
        .select({
          roundId: roundHoles.roundId,
          holeNumber: roundHoles.holeNumber,
          strokes: roundHoles.strokes,
        })
        .from(roundHoles)
        .where(inArray(roundHoles.roundId, partnerRoundIds))
    : [];

  return rows.map((r) => {
    const strokesByHole: Record<number, number | null> = {};
    for (const h of holeRows) {
      if (h.roundId === r.partnerRoundId) strokesByHole[h.holeNumber] = h.strokes;
    }
    return {
      id: r.id,
      userId: r.userId,
      name: r.name ?? "Jugador",
      partnerRoundId: r.partnerRoundId,
      strokesByHole,
    };
  });
}

/**
 * Record one hole's total strokes for a partner. Only the creator of the round
 * (who added the partner) may do this; it writes into the partner's own round.
 */
export async function savePartnerHole(
  creatorUserId: number,
  creatorRoundId: number,
  partnerUserId: number,
  holeNumber: number,
  strokes: number | null,
): Promise<{ ok?: boolean; error?: string }> {
  // Verify the creator owns the round and the partner is linked to it.
  const [owned] = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.id, creatorRoundId), eq(rounds.userId, creatorUserId)));
  if (!owned) return { error: "Vuelta no encontrada" };

  const [link] = await db
    .select({ partnerRoundId: roundPlayers.partnerRoundId })
    .from(roundPlayers)
    .where(
      and(
        eq(roundPlayers.roundId, creatorRoundId),
        eq(roundPlayers.userId, partnerUserId),
      ),
    );
  if (!link?.partnerRoundId) return { error: "Acompañante no encontrado" };
  const partnerRoundId = link.partnerRoundId;

  await db
    .update(roundHoles)
    .set({ strokes })
    .where(
      and(eq(roundHoles.roundId, partnerRoundId), eq(roundHoles.holeNumber, holeNumber)),
    );

  const all = await db
    .select({ strokes: roundHoles.strokes, putts: roundHoles.putts })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, partnerRoundId));
  const totalStrokes = all.reduce((s, h) => s + (h.strokes ?? 0), 0) || null;
  const totalPutts = all.reduce((s, h) => s + (h.putts ?? 0), 0) || null;
  await db
    .update(rounds)
    .set({ totalStrokes, totalPutts })
    .where(eq(rounds.id, partnerRoundId));

  // If the partner's round wasn't live, notify their followers once it's full.
  const [pr] = await db
    .select({ notified: rounds.notified })
    .from(rounds)
    .where(eq(rounds.id, partnerRoundId));
  if (pr && !pr.notified && all.length > 0 && all.every((h) => h.strokes != null)) {
    await db.update(rounds).set({ notified: true }).where(eq(rounds.id, partnerRoundId));
    await notifyFollowersRoundCreated(partnerUserId, partnerRoundId);
  }

  return { ok: true };
}
