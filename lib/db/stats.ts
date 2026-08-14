import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, gameTeamPlayers, shots } from "@/lib/db/schema";

const FIELD_VALUE: Record<string, number> = { "1": 1, "2": 2, "3": 3, mama: 0, miss: 0 };

function scoreFor(players: { shots: { fieldHit: string }[] }[]) {
  return players.reduce((sum, p) => sum + p.shots.reduce((s, sh) => s + (FIELD_VALUE[sh.fieldHit] ?? 0), 0), 0);
}

export type ShotDistributionEntry = { fieldHit: string; label: string; count: number; pct: number };

/** Where a player's caps land, bucketed far -> near -> risk -> miss, for the
 * home dashboard "Where the caps land" bar chart. `makeRate` is the share of
 * all shots that landed in a scoring zone (1/2/3), excluding risk and miss. */
export async function getShotDistribution(
  userId: string,
): Promise<{ makeRate: number; bars: ShotDistributionEntry[] }> {
  const rows = await db
    .select({ fieldHit: shots.fieldHit })
    .from(shots)
    .innerJoin(gameTeamPlayers, eq(shots.gameTeamPlayerId, gameTeamPlayers.id))
    .where(eq(gameTeamPlayers.userId, userId));

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.fieldHit, (counts.get(r.fieldHit) ?? 0) + 1);

  const total = rows.length;
  const scoring = (counts.get("1") ?? 0) + (counts.get("2") ?? 0) + (counts.get("3") ?? 0);
  const makeRate = total > 0 ? Math.round((scoring / total) * 100) : 0;

  const order = [
    { fieldHit: "3", label: "FAR" },
    { fieldHit: "2", label: "MID" },
    { fieldHit: "1", label: "NEAR" },
    { fieldHit: "mama", label: "RISK" },
    { fieldHit: "miss", label: "MISS" },
  ];
  const max = Math.max(1, ...order.map((o) => counts.get(o.fieldHit) ?? 0));
  const bars = order.map((o) => {
    const count = counts.get(o.fieldHit) ?? 0;
    return { fieldHit: o.fieldHit, label: o.label, count, pct: Math.round((count / max) * 100) };
  });

  return { makeRate, bars };
}

export type BestDuo = { partnerUserId: string; partnerName: string; wins: number; losses: number };

/** The teammate a player has won with the most, for the home dashboard
 * "Best duo" card. Returns null if they haven't played any games. */
export async function getBestDuo(userId: string): Promise<BestDuo | null> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: true },
  });
  if (myRows.length === 0) return null;

  const teamIds = myRows.map((r) => r.gameTeamId);
  const teammateRows = await db.query.gameTeamPlayers.findMany({
    where: inArray(gameTeamPlayers.gameTeamId, teamIds),
    with: { user: true },
  });

  const finalRankByTeam = new Map(myRows.map((r) => [r.gameTeamId, r.gameTeam.finalRank]));

  const tally = new Map<string, BestDuo>();
  for (const row of teammateRows) {
    if (row.userId === userId) continue;
    const finalRank = finalRankByTeam.get(row.gameTeamId);
    if (finalRank == null) continue;
    const entry = tally.get(row.userId) ?? {
      partnerUserId: row.userId,
      partnerName: row.user.name ?? "Player",
      wins: 0,
      losses: 0,
    };
    if (finalRank === 1) entry.wins++;
    else entry.losses++;
    tally.set(row.userId, entry);
  }

  let best: BestDuo | null = null;
  for (const duo of tally.values()) {
    if (!best || duo.wins > best.wins || (duo.wins === best.wins && duo.wins + duo.losses > best.wins + best.losses)) {
      best = duo;
    }
  }
  return best;
}

export type RecentGame = {
  id: string;
  playedAt: Date;
  result: "W" | "L";
  myScore: number;
  oppScore: number;
  opponentLabel: string;
  matType: "4" | "8";
};

/** A player's most recent games with the rival team's score and name, for
 * the home dashboard "Last nights" history list. The rival is the
 * best-placed opposing team (relevant for 8-player mats with 3+ teams). */
export async function getRecentGamesDetail(userId: string, limit = 3): Promise<RecentGame[]> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } } },
  });
  const recent = [...myRows]
    .sort((a, b) => new Date(b.gameTeam.game.playedAt).getTime() - new Date(a.gameTeam.game.playedAt).getTime())
    .slice(0, limit);
  if (recent.length === 0) return [];

  const gameIds = recent.map((r) => r.gameTeam.game.id);
  const fullGames = await db.query.games.findMany({
    where: inArray(games.id, gameIds),
    with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
  });
  const gameById = new Map(fullGames.map((g) => [g.id, g]));

  return recent.map((row) => {
    const game = gameById.get(row.gameTeam.game.id)!;
    const myTeam = game.teams.find((t) => t.id === row.gameTeamId)!;
    const rival = game.teams
      .filter((t) => t.id !== myTeam.id)
      .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))[0];

    return {
      id: game.id,
      playedAt: game.playedAt,
      result: myTeam.finalRank === 1 ? "W" : "L",
      myScore: scoreFor(myTeam.players),
      oppScore: rival ? scoreFor(rival.players) : 0,
      opponentLabel: rival ? rival.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & ") : "—",
      matType: game.matType,
    };
  });
}
