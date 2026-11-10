/**
 * /api/v1/games/[gameId]
 *
 * GET    → the game result screen: teams in finishing order with players,
 *          mama/shot counts and Elo change, the crew, comments, reaction
 *          tallies, photo and whether the viewer may delete it.
 * DELETE → deletes the game (logger, crew owner or admin; not tournament
 *          games) and refreshes the crew's stats.
 */
import { eq } from "drizzle-orm";
import { ApiError, api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { games, tournamentMatches } from "@/lib/db/schema";
import { getGameActivity } from "@/lib/db/activity";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { canDeleteGame } from "@/lib/db/game-permissions";
import { deleteGameAs, GameNotFoundError, requireGameAccess } from "@/lib/services/games";
import { expireCrew } from "@/lib/cache-tags";
import { photoSrc } from "@/lib/photo";

type Ctx = { params: Promise<{ gameId: string }> };

async function access(gameId: string, userId: string) {
  try {
    return await requireGameAccess(gameId, userId);
  } catch (e) {
    // Don't reveal whether a game exists to people outside its crew.
    if (e instanceof GameNotFoundError || (e as Error).name === "ForbiddenError") throw notFound();
    throw e;
  }
}

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  const base = await access(gameId, userId);

  const [game, activity, insights, crew, canDelete, match] = await Promise.all([
    db.query.games.findFirst({
      where: eq(games.id, gameId),
      with: { teams: { with: { players: { with: { user: { columns: { id: true, name: true, isGuest: true } }, shots: { columns: { fieldHit: true } } } } } } },
    }),
    getGameActivity(gameId, userId),
    base.groupId ? getCrewInsights(base.groupId) : null,
    base.groupId ? getCrew(base.groupId) : null,
    canDeleteGame(base, userId),
    db.query.tournamentMatches.findFirst({ where: eq(tournamentMatches.gameId, gameId), columns: { tournamentId: true } }),
  ]);
  if (!game) throw notFound();
  const elo = insights?.gameElo[gameId] ?? {};

  return {
    game: {
      id: game.id,
      playedAt: game.playedAt,
      matType: game.matType,
      createdBy: game.createdBy,
      crew: crew ? { id: crew.id, name: crew.name } : null,
      photoPath: game.photoUrl ? photoSrc(game.id, game.photoUrl) : null,
      tournamentId: match?.tournamentId ?? null,
      canDelete: canDelete && !match,
      teams: [...game.teams]
        .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))
        .map((t) => ({
          label: t.teamLabel,
          finalRank: t.finalRank,
          players: t.players.map((p) => {
            const count = (hit: string) => p.shots.filter((s) => s.fieldHit === hit).length;
            return {
              id: p.user.id,
              name: p.user.name,
              isGuest: p.user.isGuest,
              eloDelta: elo[p.user.id] ?? null,
              shots: { "1": count("1"), "2": count("2"), "3": count("3"), mama: count("mama"), miss: count("miss") },
            };
          }),
        })),
    },
    comments: activity.comments,
    reactions: activity.reactions,
  };
});

export const DELETE = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  await access(gameId, userId);
  try {
    const { groupId } = await deleteGameAs(gameId, userId);
    expireCrew(groupId);
  } catch (e) {
    if ((e as Error).name === "ForbiddenError") throw new ApiError(403, "forbidden", (e as Error).message);
    throw e;
  }
});
