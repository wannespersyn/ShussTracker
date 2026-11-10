/**
 * PATCH /api/v1/me/beta
 *
 * Settings › Beta from the app: `{ optIn: boolean }` joins or leaves the
 * beta (leaving can carry `reason`, stored as beta feedback), or
 * `{ feature, on }` switches one beta feature. Returns the fresh /me.
 */
import { api, badRequest, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getMe } from "@/lib/api/me";
import { setBetaFeature, setBetaOptIn, submitBetaFeedback } from "@/lib/db/beta";
import { BETA_GENERAL, BETA_LEAVE_REASONS, isBetaKey } from "@/lib/beta";
import { getUserCrews } from "@/lib/db/crew-insights";

export const PATCH = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  if (typeof body.optIn === "boolean") {
    await setBetaOptIn(userId, body.optIn);
    const reason = typeof body.reason === "string" ? body.reason : "";
    if (!body.optIn && (BETA_LEAVE_REASONS as readonly string[]).includes(reason)) {
      const groupId = (await getUserCrews(userId))[0]?.id ?? null;
      await submitBetaFeedback({ userId, groupId, feature: BETA_GENERAL, rating: null, text: `left: ${reason}` });
    }
  } else if (isBetaKey(body.feature) && typeof body.on === "boolean") {
    await setBetaFeature(userId, body.feature, body.on);
  } else {
    throw badRequest('Send { "optIn": boolean } or { "feature", "on": boolean }');
  }
  return getMe(userId);
});
