/**
 * POST /api/v1/claim
 *
 * `{ code }` claims a guest's games: every game the guest played moves to
 * the signed-in account and the guest row disappears (lib/db/guests.ts).
 */
import { ApiError, api, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { claimGuest, findGuestByClaimCode } from "@/lib/db/guests";
import { expireAllCrews } from "@/lib/cache-tags";
import { getT } from "@/lib/i18n/server";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const code = str(await readJson(req), "code", 20);
  const [guest, t] = await Promise.all([findGuestByClaimCode(code), getT()]);
  if (!guest) throw new ApiError(400, "invalid_code", t.errors.claimNoMatch);
  if (guest.id === userId) throw new ApiError(400, "already_you", t.errors.claimSelf);
  await claimGuest(guest.id, userId);
  expireAllCrews();
});
