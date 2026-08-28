import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { scoreForPlayers, scoreForShots } from "@/lib/scoring";

export type RecapData = {
  label: string;
  showedUp: { games: number; nights: number };
  biggestWin: { winnerNames: string; loserNames: string; margin: number } | null;
  bestDuo: { names: string; wins: number; losses: number } | null;
  redZones: { name: string; count: number } | null;
  topScorer: { name: string; points: number } | null;
  mostGames: { name: string; games: number } | null;
};

/** The 6 season-recap slides (showedUp / biggestWin / bestDuo / redZones /
 * topScorer / mostGames — see lib/theme/tokens.ts `recapSlideThemes`), all
 * derived from existing games/shots tables. "Season" defaults to the
 * current calendar year, falling back to all-time if the crew hasn't
 * logged much this year — a near-empty recap isn't worth showing. */
export async function getCrewRecap(groupId: string): Promise<RecapData> {
  const allGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
  });

  const currentYear = new Date().getFullYear();
  const thisYearGames = allGames.filter((g) => new Date(g.playedAt).getFullYear() === currentYear);
  const useAllTime = thisYearGames.length < 3;
  const scoped = useAllTime ? allGames : thisYearGames;
  const label = useAllTime ? "All-time" : String(currentYear);

  const nightKeys = new Set(scoped.map((g) => g.eventId ?? new Date(g.playedAt).toDateString()));

  let biggestWin: RecapData["biggestWin"] = null;
  const duoTally = new Map<string, { names: string; wins: number; losses: number }>();
  const riskTally = new Map<string, { name: string; count: number }>();
  const scoreTally = new Map<string, { name: string; points: number }>();
  const gameTally = new Map<string, { name: string; games: number }>();

  for (const g of scoped) {
    if (g.teams.length >= 2) {
      const ranked = [...g.teams].sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
      const winner = ranked[0];
      const loser = ranked.at(-1)!;
      const margin = scoreForPlayers(winner.players) - scoreForPlayers(loser.players);
      if (!biggestWin || margin > biggestWin.margin) {
        biggestWin = {
          winnerNames: winner.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & "),
          loserNames: loser.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & "),
          margin,
        };
      }
    }

    for (const t of g.teams) {
      if (t.players.length === 2) {
        const ids = [...t.players.map((p) => p.userId)].sort();
        const key = ids.join("+");
        const names = t.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & ");
        const entry = duoTally.get(key) ?? { names, wins: 0, losses: 0 };
        if (t.finalRank === 1) entry.wins++;
        else entry.losses++;
        duoTally.set(key, entry);
      }
      for (const p of t.players) {
        const n = p.shots.filter((s) => s.fieldHit === "mama").length;
        if (n > 0) {
          const entry = riskTally.get(p.userId) ?? { name: p.user.name ?? "Player", count: 0 };
          entry.count += n;
          riskTally.set(p.userId, entry);
        }

        const points = scoreForShots(p.shots);
        const scoreEntry = scoreTally.get(p.userId) ?? { name: p.user.name ?? "Player", points: 0 };
        scoreEntry.points += points;
        scoreTally.set(p.userId, scoreEntry);

        const gameEntry = gameTally.get(p.userId) ?? { name: p.user.name ?? "Player", games: 0 };
        gameEntry.games += 1;
        gameTally.set(p.userId, gameEntry);
      }
    }
  }

  const bestDuo = [...duoTally.values()].sort((a, b) => b.wins - a.wins)[0] ?? null;
  const redZones = [...riskTally.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const topScorer = [...scoreTally.values()].sort((a, b) => b.points - a.points)[0] ?? null;
  const mostGames = [...gameTally.values()].sort((a, b) => b.games - a.games)[0] ?? null;

  return {
    label,
    showedUp: { games: scoped.length, nights: nightKeys.size },
    biggestWin,
    bestDuo,
    redZones,
    topScorer,
    mostGames,
  };
}
