/**
 * POST /api/v1/auth/google
 *
 * App sign-in with Google: body `{ idToken }` from the native Google sign-in.
 * Verifies the token, finds or creates the user (same account as on the
 * website) and returns `{ token, expiresAt, created, ...me }`.
 */
import { api, readJson, str } from "@/lib/api/http";
import { findOrCreateUser, verifyGoogleIdToken } from "@/lib/api/identity";
import { createAppSession } from "@/lib/api/session";
import { getMe } from "@/lib/api/me";

export const POST = api(async (req) => {
  const body = await readJson(req);
  const identity = await verifyGoogleIdToken(str(body, "idToken", 8000));
  const { userId, created } = await findOrCreateUser(identity);
  const session = await createAppSession(userId);
  return { ...session, created, ...(await getMe(userId)) };
});
