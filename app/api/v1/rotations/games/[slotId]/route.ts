/**
 * POST /api/v1/rotations/games/[slotId]
 *
 * Logs one planned game of an Americano / Mexicano: `{ teams, shotsByPlayer,
 * mat? }` (same shapes as POST /api/v1/games, 2v2). The teams must be the
 * planned duos. Returns `{ rotationId, gameId }` — gameId is null when
 * someone else logged that game first.
 */
import { api, badRequest, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { hasBeta } from "@/lib/db/beta";
import { parseMatLog, parseTeamsAndShots } from "@/lib/services/log-game";
import { playRotationGameAs } from "@/lib/services/rotations";

type Ctx = { params: Promise<{ slotId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { slotId } = await params;
  const body = await readJson(req);
  const { teams, shots } = parseTeamsAndShots(body, "4");
  const mat = body.mat !== undefined && (await hasBeta(userId, "mat")) ? parseMatLog(body.mat, teams.flatMap((t) => t.playerIds)) : undefined;
  try {
    const out = await playRotationGameAs(userId, { rotationGameId: slotId, teams, shotsByPlayer: shots, mat });
    return Response.json(out, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /match|not found/i.test(e.message)) throw badRequest(e.message);
    throw e;
  }
});
