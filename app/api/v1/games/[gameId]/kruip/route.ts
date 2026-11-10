/**
 * PATCH /api/v1/games/[gameId]/kruip
 *
 * `{ gameTeamId, kruip }` sets or clears "kruipen" for a losing team after
 * the fact. Allowed for the game's players, its logger, the crew owner and
 * admins (canEditKruip). The winning team can't kruip.
 */
import { and, eq } from "drizzle-orm";
import { api, badRequest, notFound, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { gameTeams } from "@/lib/db/schema";
import { ForbiddenError } from "@/lib/db/authz";
import { canEditKruip } from "@/lib/db/game-permissions";
import { GameNotFoundError, requireGameAccess } from "@/lib/services/games";
import { expireCrew } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ gameId: string }> };

export const PATCH = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  const body = await readJson(req);
  if (typeof body.gameTeamId !== "string" || typeof body.kruip !== "boolean") throw badRequest('Send { "gameTeamId", "kruip": true|false }');

  let game;
  try {
    game = await requireGameAccess(gameId, userId);
  } catch (e) {
    if (e instanceof GameNotFoundError || e instanceof ForbiddenError) throw notFound();
    throw e;
  }
  if (!(await canEditKruip(game, userId))) throw new ForbiddenError();
  const team = await db.query.gameTeams.findFirst({ where: and(eq(gameTeams.id, body.gameTeamId), eq(gameTeams.gameId, gameId)) });
  if (!team) throw notFound();
  if (team.finalRank === 1) throw badRequest("Only a losing team can kruip");

  await db.update(gameTeams).set({ kruip: body.kruip }).where(eq(gameTeams.id, team.id));
  expireCrew(game.groupId);
});
