/**
 * App sessions
 *
 * Bearer-token sessions for the mobile app, stored in the same Auth.js
 * `session` table as web sessions (so account deletion and cascades just
 * work). Only a SHA-256 hash of the token is stored, prefixed `app:`.
 *
 * Exports: createAppSession, revokeAppSession, requireApiUser, optionalApiUser
 * Notes: 90-day tokens, extended on use once less than 60 days remain.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { UnauthorizedError } from "@/lib/db/authz";

const DAY = 24 * 3600 * 1000;
const LIFETIME = 90 * DAY;
const RENEW_BELOW = 60 * DAY;

const keyFor = (token: string) => `app:${createHash("sha256").update(token).digest("hex")}`;

/** Creates a session and returns the raw token (shown to the app once). */
export async function createAppSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME);
  await db.insert(sessions).values({ sessionToken: keyFor(token), userId, expires: expiresAt });
  return { token, expiresAt };
}

export async function revokeAppSession(token: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, keyFor(token)));
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  return m ? m[1] : null;
}

/** The user behind the request's bearer token, or null. */
export async function optionalApiUser(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const key = keyFor(token);
  const row = await db.query.sessions.findFirst({ where: eq(sessions.sessionToken, key) });
  if (!row) return null;
  const now = Date.now();
  if (row.expires.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.sessionToken, key));
    return null;
  }
  if (row.expires.getTime() - now < RENEW_BELOW) {
    await db.update(sessions).set({ expires: new Date(now + LIFETIME) }).where(eq(sessions.sessionToken, key));
  }
  return row.userId;
}

/** The user behind the bearer token, or throws UnauthorizedError (→ 401). */
export async function requireApiUser(req: Request): Promise<string> {
  const userId = await optionalApiUser(req);
  if (!userId) throw new UnauthorizedError();
  return userId;
}
