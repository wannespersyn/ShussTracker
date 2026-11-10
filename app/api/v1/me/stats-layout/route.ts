/**
 * /api/v1/me/stats-layout
 *
 * GET → the player's own stats page layout (screens of blocks), or
 *       `{ layout: null }` for the default.
 * PUT → `{ layout }` saves it (sanitized; 400 when nothing valid is left).
 */
import { api, badRequest, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getStatsLayout, saveStatsLayout } from "@/lib/db/stats-layout";

export const GET = api(async (req) => ({ layout: await getStatsLayout(await requireApiUser(req)) }));

export const PUT = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  if (!(await saveStatsLayout(userId, body.layout))) throw badRequest("Invalid layout");
  return { layout: await getStatsLayout(userId) };
});
