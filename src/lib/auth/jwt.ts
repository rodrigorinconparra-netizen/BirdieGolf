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

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-insecure-secret-change-me-in-env",
);

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
