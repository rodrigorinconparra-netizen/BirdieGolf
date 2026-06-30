import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  signToken,
  verifyToken,
  type SessionPayload,
} from "./jwt";

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Returns the current session payload, or null if not authenticated. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
