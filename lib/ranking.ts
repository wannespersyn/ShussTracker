/** Wilson score lower bound (95% CI) for a win rate. Ranks a small, lucky
 * sample (1 win from 1 game) below a larger, steadier one (27 wins from 30)
 * even though the raw percentage is lower — used to sort win-rate
 * leaderboards so volume of play counts, not just the fraction won. */
export function wilsonLowerBound(wins: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const phat = wins / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = phat + z2 / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total);
  return (center - margin) / denominator;
}
