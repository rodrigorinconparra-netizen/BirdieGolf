"use server";

import { getSession } from "@/lib/auth/session";
import { saveDeviceToken } from "@/lib/push";

/** Stores the device's FCM push token for the logged-in user. */
export async function registerDeviceTokenAction(
  token: string,
  platform: string | null,
): Promise<void> {
  const session = await getSession();
  if (!session || !token) return;
  await saveDeviceToken(session.userId, token, platform);
}
