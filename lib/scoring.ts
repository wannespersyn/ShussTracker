export const FIELD_VALUE: Record<string, number> = { "1": 1, "2": 2, "3": 3, mama: 0, miss: 0 };

export function scoreForShots(shots: { fieldHit: string }[]): number {
  return shots.reduce((sum, s) => sum + (FIELD_VALUE[s.fieldHit] ?? 0), 0);
}

/** Sums a team's score from its players' shots — shared by any code that
 * needs a game/team's point total (stats, H2H, event standings). */
export function scoreForPlayers(players: { shots: { fieldHit: string }[] }[]): number {
  return players.reduce((sum, p) => sum + scoreForShots(p.shots), 0);
}
