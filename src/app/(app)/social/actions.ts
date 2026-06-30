"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { follows, notifications, rounds } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { searchUsers, getPublicFeed, type FeedRound } from "@/lib/social";

export async function searchUsersAction(query: string) {
  const session = await getSession();
  if (!session) return [];
  return searchUsers(query, session.userId);
}

export async function loadPublicFeedAction(
  lat: number | null,
  lon: number | null,
): Promise<FeedRound[]> {
  const session = await getSession();
  if (!session) return [];
  return getPublicFeed(session.userId, lat, lon);
}

export async function followAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const targetId = Number(formData.get("userId"));
  if (!targetId || targetId === session.userId) return;
  await db
    .insert(follows)
    .values({ followerId: session.userId, followingId: targetId })
    .onConflictDoNothing({ target: [follows.followerId, follows.followingId] });
  revalidatePath(`/players/${targetId}`);
  revalidatePath("/feed");
}

export async function unfollowAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const targetId = Number(formData.get("userId"));
  if (!targetId) return;
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, session.userId), eq(follows.followingId, targetId)));
  revalidatePath(`/players/${targetId}`);
  revalidatePath("/feed");
}

export async function toggleNotifyAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const targetId = Number(formData.get("userId"));
  const notify = String(formData.get("notify")) === "true";
  if (!targetId) return;
  const [rel] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, session.userId), eq(follows.followingId, targetId)));
  if (rel) {
    await db.update(follows).set({ notify }).where(eq(follows.id, rel.id));
  } else {
    // following is required to get notifications
    await db
      .insert(follows)
      .values({ followerId: session.userId, followingId: targetId, notify })
      .onConflictDoUpdate({
        target: [follows.followerId, follows.followingId],
        set: { notify },
      });
  }
  revalidatePath(`/players/${targetId}`);
}

export async function toggleRoundPublicAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const roundId = Number(formData.get("roundId"));
  const makePublic = String(formData.get("isPublic")) === "true";
  if (!roundId) return;

  const [round] = await db
    .select({ id: rounds.id, userId: rounds.userId, isPublic: rounds.isPublic })
    .from(rounds)
    .where(eq(rounds.id, roundId));
  if (!round || round.userId !== session.userId) return;

  await db
    .update(rounds)
    .set({ isPublic: makePublic, publishedAt: makePublic ? new Date() : null })
    .where(eq(rounds.id, roundId));

  // Notify followers who opted in, only on first/again publish.
  if (makePublic && !round.isPublic) {
    const subs = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followingId, session.userId), eq(follows.notify, true)));
    if (subs.length) {
      await db.insert(notifications).values(
        subs.map((s) => ({
          userId: s.followerId,
          actorId: session.userId,
          roundId,
          type: "round_published",
        })),
      );
    }
  }

  revalidatePath(`/rounds/${roundId}`);
  revalidatePath("/feed");
  revalidatePath(`/players/${session.userId}`);
}

export async function markNotificationsReadAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, session.userId), eq(notifications.read, false)));
  revalidatePath("/notifications");
}
