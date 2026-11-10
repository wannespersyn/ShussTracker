/**
 * App sign-in identity
 *
 * Verifies Google and Apple ID tokens sent by the mobile app (signature via
 * the provider's JWKS, issuer, audience, expiry) and maps them to a user:
 * existing provider link → same verified email → new user. Google links use
 * the same `account` rows Auth.js creates, so web and app share one user.
 *
 * Exports: verifyGoogleIdToken, verifyAppleIdToken, findOrCreateUser
 * Env: GOOGLE_CLIENT_IDS (iOS/Android client ids, comma-separated; AUTH_GOOGLE_ID
 *      is accepted too), APPLE_CLIENT_IDS (bundle id / services id).
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api/http";

export type VerifiedIdentity = {
  provider: "google" | "apple";
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

const list = (...values: (string | undefined)[]) =>
  values.flatMap((v) => (v ?? "").split(",")).map((s) => s.trim()).filter(Boolean);

// JWKS URLs can be pointed at a local key set in development/tests only.
const dev = process.env.NODE_ENV !== "production";
const googleJwks = createRemoteJWKSet(new URL((dev && process.env.GOOGLE_JWKS_URL) || "https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL((dev && process.env.APPLE_JWKS_URL) || "https://appleid.apple.com/auth/keys"));

const invalid = () => new ApiError(401, "invalid_token", "Sign-in token is invalid or expired");
const truthy = (v: unknown) => v === true || v === "true";

async function verify(token: string, jwks: ReturnType<typeof createRemoteJWKSet>, issuer: string[], audience: string[]): Promise<JWTPayload> {
  if (audience.length === 0) throw new ApiError(503, "not_configured", "This sign-in method isn't configured yet");
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience });
    if (!payload.sub) throw invalid();
    return payload;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw invalid();
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedIdentity> {
  const p = await verify(
    idToken,
    googleJwks,
    ["https://accounts.google.com", "accounts.google.com"],
    list(process.env.GOOGLE_CLIENT_IDS, process.env.AUTH_GOOGLE_ID),
  );
  return {
    provider: "google",
    sub: p.sub!,
    email: typeof p.email === "string" ? p.email.toLowerCase() : null,
    emailVerified: truthy(p.email_verified),
    name: typeof p.name === "string" ? p.name : null,
    picture: typeof p.picture === "string" ? p.picture : null,
  };
}

/** Apple only puts the user's name in the app-side result of the very first
 * sign-in, never in the token, so the app passes it along separately. */
export async function verifyAppleIdToken(identityToken: string, fullName: string | null): Promise<VerifiedIdentity> {
  const p = await verify(identityToken, appleJwks, ["https://appleid.apple.com"], list(process.env.APPLE_CLIENT_IDS));
  return {
    provider: "apple",
    sub: p.sub!,
    email: typeof p.email === "string" ? p.email.toLowerCase() : null,
    emailVerified: truthy(p.email_verified),
    name: fullName,
    picture: null,
  };
}

/** Existing provider link → existing user with the same verified email
 * (linked from now on) → brand-new user. Returns the user id and whether
 * it was just created. */
export async function findOrCreateUser(id: VerifiedIdentity): Promise<{ userId: string; created: boolean }> {
  const linked = await db.query.accounts.findFirst({
    where: and(eq(accounts.provider, id.provider), eq(accounts.providerAccountId, id.sub)),
    columns: { userId: true },
  });
  if (linked) return { userId: linked.userId, created: false };

  const link = (userId: string) =>
    db.insert(accounts).values({ userId, type: "oidc", provider: id.provider, providerAccountId: id.sub }).onConflictDoNothing();

  if (id.email && id.emailVerified) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, id.email), columns: { id: true } });
    if (existing) {
      await link(existing.id);
      return { userId: existing.id, created: false };
    }
  }

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: id.name,
    email: id.email && id.emailVerified ? id.email : null,
    emailVerified: id.email && id.emailVerified ? new Date() : null,
    image: id.picture,
  });
  await link(userId);
  return { userId, created: true };
}
