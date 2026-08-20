import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTeamPlayers, games } from "@/lib/db/schema";
import { scoreForPlayers as scoreFor } from "@/lib/scoring";

export type HeadToHeadMeeting = {
  gameId: string;
  playedAt: Date;
  aWon: boolean;
  aScore: number;
  bScore: number;
  matType: "2" | "4" | "8";
};

export type HeadToHead = { aWins: number; bWins: number; meetings: HeadToHeadMeeting[] };

/** Every game where userA and userB were on OPPOSING teams — a different
 * relationship than stats-logic.ts's "duo" (teammates). Meetings are
 * newest-first. */
export async function getHeadToHead(userIdA: string, userIdB: string): Promise<HeadToHead> {
  const [aRows, bRows] = await Promise.all([
    db.query.gameTeamPlayers.findMany({
      where: eq(gameTeamPlayers.userId, userIdA),
      with: { gameTeam: { with: { game: true } } },
    }),
    db.query.gameTeamPlayers.findMany({
      where: eq(gameTeamPlayers.userId, userIdB),
      with: { gameTeam: { with: { game: true } } },
    }),
  ]);
  const bTeamByGame = new Map(bRows.map((r) => [r.gameTeam.game.id, r.gameTeamId]));

  const sharedGameIds = aRows
    .filter((r) => {
      const bTeamId = bTeamByGame.get(r.gameTeam.game.id);
      return bTeamId !== undefined && bTeamId !== r.gameTeamId;
    })
    .map((r) => r.gameTeam.game.id);

  if (sharedGameIds.length === 0) return { aWins: 0, bWins: 0, meetings: [] };

  const fullGames = await db.query.games.findMany({
    where: inArray(games.id, sharedGameIds),
    with: { teams: { with: { players: { with: { shots: true } } } } },
  });

  let aWins = 0;
  let bWins = 0;
  const meetings: HeadToHeadMeeting[] = fullGames
    .map((game) => {
      const teamA = game.teams.find((t) => t.players.some((p) => p.userId === userIdA))!;
      const teamB = game.teams.find((t) => t.players.some((p) => p.userId === userIdB))!;
      const aWon = (teamA.finalRank ?? 99) < (teamB.finalRank ?? 99);
      if (aWon) aWins++;
      else bWins++;
      return {
        gameId: game.id,
        playedAt: game.playedAt,
        aWon,
        aScore: scoreFor(teamA.players),
        bScore: scoreFor(teamB.players),
        matType: game.matType,
      };
    })
    .sort((x, y) => y.playedAt.getTime() - x.playedAt.getTime());

  return { aWins, bWins, meetings };
}
