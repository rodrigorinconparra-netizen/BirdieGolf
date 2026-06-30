import "server-only";
import { eq, inArray } from "drizzle-orm";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "@/lib/db";
import { deviceTokens } from "@/lib/db/schema";

/**
 * Envío de notificaciones push nativas vía Firebase Cloud Messaging (HTTP v1).
 * FCM cubre Android e iOS (con APNs configurado en Firebase).
 *
 * Requiere (env, de una cuenta de servicio de Firebase):
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
 * Si no están, las funciones son no-op (la app sigue funcionando sin push).
 */

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

let cachedToken: { value: string; exp: number } | null = null;

function fcmConfig() {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function isPushConfigured(): boolean {
  return fcmConfig() != null;
}

async function getAccessToken(): Promise<string | null> {
  const cfg = fcmConfig();
  if (!cfg) return null;
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;

  try {
    const key = await importPKCS8(cfg.privateKey, "RS256");
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(cfg.clientEmail)
      .setSubject(cfg.clientEmail)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  } catch {
    return null;
  }
}

/** Envía una push a todos los dispositivos de un usuario. No-op si FCM no está configurado. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  await sendPushToUsers([userId], payload);
}

/** Envía una push a varios usuarios. No-op si FCM no está configurado. */
export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  const cfg = fcmConfig();
  if (!cfg || userIds.length === 0) return;
  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const tokens = await db
    .select({ id: deviceTokens.id, token: deviceTokens.token })
    .from(deviceTokens)
    .where(inArray(deviceTokens.userId, userIds));
  if (tokens.length === 0) return;

  const url = `https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`;
  const stale: number[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
            },
          }),
        });
        // 404/400 UNREGISTERED → token caducado: lo marcamos para limpiar.
        if (res.status === 404 || res.status === 400) stale.push(t.id);
      } catch {
        /* ignore individual failures */
      }
    }),
  );

  if (stale.length) {
    await db.delete(deviceTokens).where(inArray(deviceTokens.id, stale));
  }
}

/** Guarda/actualiza el token push de un dispositivo para un usuario. */
export async function saveDeviceToken(
  userId: number,
  token: string,
  platform: string | null,
): Promise<void> {
  if (!token) return;
  // El token es único: si ya existía (otro user/dispositivo), lo reasignamos a este user.
  await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  await db.insert(deviceTokens).values({ userId, token, platform });
}
