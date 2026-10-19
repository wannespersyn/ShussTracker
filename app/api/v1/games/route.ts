/**
 * POST /api/v1/games
 *
 * Logs a finished game: `{ groupId, matType, teams: [{ label?, playerIds,
 * finalRank }], shotsByPlayer: [{ playerId, fieldHit }] }`. The input is
 * fully validated (lib/services/log-game.ts), crew stats are refreshed and
 * the other players get a push. Returns `{ gameId }` with 201.
 */
import { after } from "next/server";
import { api, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { createGameRecord } from "@/lib/db/games";
import { parseLogGameInput } from "@/lib/services/log-game";
import { expireCrew } from "@/lib/cache-tags";
import { notifyGameLogged } from "@/lib/notify";

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  if (typeof body.groupId === "string") await requireGroupMember(userId, body.groupId);
  const input = await parseLogGameInput(body, userId);
  const { gameId } = await createGameRecord(input);
  expireCrew(input.groupId);
  after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  return Response.json({ gameId }, { status: 201 });
});
