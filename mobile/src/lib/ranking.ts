/**
 * Ranking helpers
 *
 * Wilson score lower bound — the same duo ranking the website uses, so a
 * 3–0 duo doesn't outrank a 30–10 one.
 */
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
