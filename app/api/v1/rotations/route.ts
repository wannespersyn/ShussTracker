/**
 * POST /api/v1/rotations
 *
 * Starts an Americano / Mexicano: `{ groupId, name, mode, playerIds, mats,
 * rounds }`. Everyone must be in the crew (4–24 players). Returns `{ id }`.
 */
import { api, badRequest, oneOf, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { createRotationAs } from "@/lib/services/rotations";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  if (typeof body.groupId !== "string") throw badRequest('"groupId" is required');
  if (!Array.isArray(body.playerIds) || !body.playerIds.every((x) => typeof x === "string")) throw badRequest('"playerIds" must be a list of ids');
  const mode = oneOf(body, "mode", ["americano", "mexicano"] as const);
  const mats = Number(body.mats);
  const rounds = Number(body.rounds);
  if (!Number.isFinite(mats) || !Number.isFinite(rounds)) throw badRequest('"mats" and "rounds" must be numbers');
  try {
    const id = await createRotationAs(userId, {
      groupId: body.groupId,
      name: typeof body.name === "string" ? body.name : "",
      mode,
      playerIds: body.playerIds as string[],
      mats,
      rounds,
    });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /crew|players/.test(e.message)) throw badRequest(e.message);
    throw e;
  }
});
