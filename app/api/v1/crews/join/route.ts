/**
 * POST /api/v1/crews/join
 *
 * `{ code }` joins a crew by invite code (idempotent if already a member).
 * Returns `{ crewId }`, or 400 with a translated message for a bad code.
 */
import { ApiError, api, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { joinCrewByCode } from "@/lib/db/crews";
import { expireCrew } from "@/lib/cache-tags";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  const result = await joinCrewByCode(userId, typeof body.code === "string" ? body.code : "");
  if (result.error) throw new ApiError(400, "invalid_code", result.error);
  expireCrew(result.groupId);
  return { crewId: result.groupId };
});
