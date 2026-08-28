export const ELO_BASE = 1000;
export const ELO_K = 48;

export type EloGame = {
  playedAt: Date;
  teams: { playerIds: string[]; finalRank: number | null }[];
};

export type EloRating = { rating: number; gamesPlayed: number };

function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Elo, applied to a whole team at once and then split evenly across its
 * players — the standard way to extend 1v1 Elo to duos. A game with more
 * than two teams (the 8-player mat, up to four duos) is scored as a
 * round-robin of pairwise comparisons between every pair of teams (better
 * `finalRank` "beats" worse), with each pair's rating swing divided by
 * (teamCount - 1) so an 8-player game doesn't move ratings further than a
 * 1v1 just because there were more pairs to settle in it. */
export function computeEloRatings(games: EloGame[]): Map<string, EloRating> {
  const ratings = new Map<string, number>();
  const gamesPlayed = new Map<string, number>();
  const ratingOf = (id: string) => ratings.get(id) ?? ELO_BASE;

  const chronological = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  for (const game of chronological) {
    const teams = game.teams.filter((t) => t.finalRank != null && t.playerIds.length > 0);
    if (teams.length < 2) continue;

    const teamRating = (playerIds: string[]) =>
      playerIds.reduce((sum, id) => sum + ratingOf(id), 0) / playerIds.length;

    const deltas = new Map<string, number>();
    const pairCount = teams.length - 1;

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];
        const expectedA = expectedScore(teamRating(teamA.playerIds), teamRating(teamB.playerIds));
        const rankA = teamA.finalRank!;
        const rankB = teamB.finalRank!;
        const actualA = rankA === rankB ? 0.5 : rankA < rankB ? 1 : 0;
        const change = (ELO_K * (actualA - expectedA)) / pairCount;

        for (const id of teamA.playerIds) deltas.set(id, (deltas.get(id) ?? 0) + change);
        for (const id of teamB.playerIds) deltas.set(id, (deltas.get(id) ?? 0) - change);
      }
    }

    for (const team of teams) {
      for (const id of team.playerIds) gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
    }
    for (const [id, delta] of deltas) ratings.set(id, ratingOf(id) + delta);
  }

  const result = new Map<string, EloRating>();
  for (const id of gamesPlayed.keys()) {
    result.set(id, { rating: Math.round(ratingOf(id)), gamesPlayed: gamesPlayed.get(id) ?? 0 });
  }
  return result;
}
