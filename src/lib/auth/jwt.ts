import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe JWT helpers (no next/headers, no node APIs) so they can be used
 * from both middleware and server code.
 */

export const SESSION_COOKIE = "birdie_session";

export type Role = "superadmin" | "player";

export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}

/**
 * The signing key. In production AUTH_SECRET MUST be set — otherwise we throw
 * loudly instead of silently using a known, forgeable secret. In development we
 * fall back to a fixed dev secret for convenience.
 */
function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET is not set. Set a strong random value in the environment.",
      );
    }
    return new TextEncoder().encode("dev-insecure-secret-change-me-in-env");
  }
  return new TextEncoder().encode(s);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
