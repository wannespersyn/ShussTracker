/**
 * /api/v1/crews
 *
 * GET  → the signed-in user's crews, most active first.
 * POST → `{ name }` starts a new crew with the user as owner; returns it.
 */
import { api, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getUserCrews } from "@/lib/db/crew-insights";
import { createCrewForUser } from "@/lib/db/crews";
import { expireCrew } from "@/lib/cache-tags";

export const GET = api(async (req) => {
  const userId = await requireApiUser(req);
  const crews = await getUserCrews(userId);
  return { crews: crews.map((c) => ({ ...c, isOwner: c.createdBy === userId })) };
});

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const name = str(await readJson(req), "name", 40);
  const crewId = await createCrewForUser(userId, name);
  expireCrew(crewId);
  return Response.json({ crewId }, { status: 201 });
});
