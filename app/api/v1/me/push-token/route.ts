/**
 * /api/v1/me/push-token
 *
 * POST   → `{ token, platform: "ios" | "android" }` registers this device's
 *          Expo push token; the request language (Accept-Language) is stored
 *          so notifications arrive in it.
 * DELETE → `{ token }` unregisters it (e.g. notifications turned off).
 */
import { api, oneOf, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { removeAppPushToken, saveAppPushToken } from "@/lib/push";
import { getLocale } from "@/lib/i18n/server";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  await saveAppPushToken(userId, str(body, "token", 300), oneOf(body, "platform", ["ios", "android"] as const), await getLocale());
});

export const DELETE = api(async (req) => {
  const userId = await requireApiUser(req);
  await removeAppPushToken(userId, str(await readJson(req), "token", 300));
});
