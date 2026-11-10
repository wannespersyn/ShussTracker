/**
 * POST /api/v1/auth/apple
 *
 * App sign-in with Apple: body `{ identityToken, fullName? }`. Apple only
 * shares the name on the very first sign-in, so the app forwards it.
 * Returns `{ token, expiresAt, created, ...me }`.
 */
import { api, readJson, str } from "@/lib/api/http";
import { findOrCreateUser, verifyAppleIdToken } from "@/lib/api/identity";
import { createAppSession } from "@/lib/api/session";
import { getMe } from "@/lib/api/me";

export const POST = api(async (req) => {
  const body = await readJson(req);
  const fullName = typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim().slice(0, 80) : null;
  const identity = await verifyAppleIdToken(str(body, "identityToken", 8000), fullName);
  const { userId, created } = await findOrCreateUser(identity);
  const session = await createAppSession(userId);
  return { ...session, created, ...(await getMe(userId)) };
});
