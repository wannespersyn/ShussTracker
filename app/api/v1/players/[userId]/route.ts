/**
 * GET /api/v1/players/[userId]
 *
 * A player's profile as seen by the viewer: basics, their row in the most
 * active crew both share (Elo, rank, form, Elo history), achievements with
 * progress, nemesis and frequent opponents. Only for players who share a
 * crew with the viewer (404 otherwise, so ids can't be probed).
 */
import { eq } from "drizzle-orm";
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSharesCrew } from "@/lib/db/authz";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getPlayerAchievements } from "@/lib/db/player-achievements";
import { getNemesis } from "@/lib/db/h2h";
import { getPlayerOpponents } from "@/lib/db/players";

type Ctx = { params: Promise<{ userId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const viewerId = await requireApiUser(req);
  const { userId } = await params;
  const player = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true, image: true, isGuest: true } });
  if (!player) throw notFound();
  await requireSharesCrew(viewerId, userId).catch(() => {
    throw notFound();
  });

  const [viewerCrews, playerCrews, opponents, achievements, nemesis] = await Promise.all([
    getUserCrews(viewerId),
    getUserCrews(userId),
    getPlayerOpponents(userId),
    getPlayerAchievements(userId, new Date()),
    getNemesis(userId),
  ]);
  const shared = viewerCrews.find((c) => playerCrews.some((p) => p.id === c.id)) ?? playerCrews[0] ?? null;
  const insights = shared ? await getCrewInsights(shared.id) : null;
  const stats = insights?.players.find((p) => p.userId === userId) ?? null;

  return {
    player: { ...player, isSelf: viewerId === userId },
    crew: shared ? { id: shared.id, name: shared.name, rankedPlayers: insights!.players.filter((p) => p.games > 0).length } : null,
    stats,
    achievements,
    nemesis,
    opponents,
  };
});
