export const FIELD_VALUE: Record<string, number> = { "1": 1, "2": 2, "3": 3, mama: 0, miss: 0 };

type ShotLike = { fieldHit: string; ownGoal?: boolean };
type PlayerLike = { shots: ShotLike[] };

/** Points a player's own shots earn for their team. Own goals (a defense
 * that knocked a cap into a zone scoring for the other side) don't count
 * here — they go to the opponents, see `scoreForPlayers`. */
export function scoreForShots(shots: ShotLike[]): number {
  return shots.reduce((sum, s) => sum + (s.ownGoal ? 0 : (FIELD_VALUE[s.fieldHit] ?? 0)), 0);
}

/** Points a set of players gifted to the other side via own goals. */
export function ownGoalPoints(players: PlayerLike[]): number {
  return players.reduce((sum, p) => sum + p.shots.reduce((n, s) => n + (s.ownGoal ? (FIELD_VALUE[s.fieldHit] ?? 0) : 0), 0), 0);
}

/** Sums a team's score from its players' shots — shared by any code that
 * needs a game/team's point total (stats, H2H). Pass the opposing players
 * so their own goals are credited to this team. */
export function scoreForPlayers(players: PlayerLike[], opponents: PlayerLike[] = []): number {
  return players.reduce((sum, p) => sum + scoreForShots(p.shots), 0) + ownGoalPoints(opponents);
}
