import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, gameTeamPlayers, games } from "@/lib/db/schema";

export type PlayerCrew = { id: string; name: string };

export async function getPlayerCrews(userId: string): Promise<PlayerCrew[]> {
  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: true },
  });
  return memberships.map((m) => ({ id: m.group.id, name: m.group.name }));
}

export type PlayerOpponent = { userId: string; name: string; timesPlayed: number };

/** Everyone a player has ever shared a mat with on the OPPOSING team (not
 * teammates — see stats-logic.ts's "duo" for that relationship). Powers
 * the head-to-head opponent picker on a profile page. */
export async function getPlayerOpponents(userId: string): Promise<PlayerOpponent[]> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } } },
  });
  if (myRows.length === 0) return [];

  const myTeamIdByGame = new Map(myRows.map((r) => [r.gameTeam.game.id, r.gameTeamId]));
  const gameIds = [...myTeamIdByGame.keys()];

  const fullGames = await db.query.games.findMany({
    where: inArray(games.id, gameIds),
    with: { teams: { with: { players: { with: { user: true } } } } },
  });

  const tally = new Map<string, PlayerOpponent>();
  for (const game of fullGames) {
    const myTeamId = myTeamIdByGame.get(game.id);
    for (const team of game.teams) {
      if (team.id === myTeamId) continue;
      for (const p of team.players) {
        const entry = tally.get(p.userId) ?? { userId: p.userId, name: p.user.name ?? "Player", timesPlayed: 0 };
        entry.timesPlayed++;
        tally.set(p.userId, entry);
      }
    }
  }
  return [...tally.values()].sort((a, b) => b.timesPlayed - a.timesPlayed);
}
