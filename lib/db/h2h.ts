import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTeamPlayers, games } from "@/lib/db/schema";
import { scoreForPlayers as scoreFor } from "@/lib/scoring";
import { wilsonLowerBound } from "@/lib/ranking";

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

export type NemesisResult = { opponentId: string; opponentName: string; wins: number; losses: number };

/** The single opponent a player has the worst record against — ranked by
 * Wilson lower bound of their LOSS rate (so a fluke 0-2 doesn't outrank a
 * grinding 3-11), and requires at least 2 meetings before crowning one, so
 * a single unlucky game doesn't hand someone a nemesis. Null if nobody
 * qualifies yet. */
export async function getNemesis(userId: string): Promise<NemesisResult | null> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } } },
  });
  if (myRows.length === 0) return null;

  const myTeamIdByGame = new Map(myRows.map((r) => [r.gameTeam.game.id, r.gameTeamId]));
  const gameIds = [...myTeamIdByGame.keys()];

  const fullGames = await db.query.games.findMany({
    where: inArray(games.id, gameIds),
    with: { teams: { with: { players: { with: { user: true } } } } },
  });

  const tally = new Map<string, { name: string; wins: number; losses: number }>();
  for (const game of fullGames) {
    const myTeamId = myTeamIdByGame.get(game.id);
    const myTeam = game.teams.find((t) => t.id === myTeamId);
    if (!myTeam) continue;
    const myWon = myTeam.finalRank === 1;
    for (const team of game.teams) {
      if (team.id === myTeamId) continue;
      for (const p of team.players) {
        const entry = tally.get(p.userId) ?? { name: p.user.name ?? "Player", wins: 0, losses: 0 };
        if (myWon) entry.wins++;
        else entry.losses++;
        tally.set(p.userId, entry);
      }
    }
  }

  let nemesis: NemesisResult | null = null;
  let worstScore = -1;
  for (const [opponentId, d] of tally) {
    const total = d.wins + d.losses;
    if (total < 2) continue;
    const score = wilsonLowerBound(d.losses, total);
    if (score > worstScore) {
      worstScore = score;
      nemesis = { opponentId, opponentName: d.name, wins: d.wins, losses: d.losses };
    }
  }
  return nemesis;
}
