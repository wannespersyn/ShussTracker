/**
 * POST /api/v1/auth/logout
 *
 * Ends the app session behind the bearer token and, when the body carries
 * `{ pushToken }`, unregisters that device from push. Always 204.
 */
import { api } from "@/lib/api/http";
import { bearerToken, optionalApiUser, revokeAppSession } from "@/lib/api/session";
import { removeAppPushToken } from "@/lib/push";

export const POST = api(async (req) => {
  const token = bearerToken(req);
  if (!token) return;
  const userId = await optionalApiUser(req);
  const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
  if (userId && typeof body?.pushToken === "string") await removeAppPushToken(userId, body.pushToken);
  await revokeAppSession(token);
});
