/**
 * Streak heat (beta "Viermomenten"): the higher the win streak, the hotter
 * the colour — orange (3–4), red (5–7), blue (8–11), purple (12+). Used by
 * the streak celebration and the home screen's on-fire state.
 */
export type StreakTier = {
  level: 0 | 1 | 2 | 3;
  /** Flame body, outline, inner flame, core and the accent for numbers/badges. */
  flame: string;
  stroke: string;
  inner: string;
  core: string;
  accent: string;
  /** Text colour on a `flame` fill. */
  onFlame: string;
};

export function streakTier(n: number): StreakTier {
  if (n >= 12) return { level: 3, flame: "#8B3DFF", stroke: "#4B1A99", inner: "#FF7FE0", core: "#FFFFFF", accent: "#D9B3FF", onFlame: "#FFFFFF" };
  if (n >= 8) return { level: 2, flame: "#2F6BFF", stroke: "#1A2F99", inner: "#6FD3FF", core: "#E6F8FF", accent: "#6FD3FF", onFlame: "#FFFFFF" };
  if (n >= 5) return { level: 1, flame: "#E0261A", stroke: "#8A0F08", inner: "#FF6B1A", core: "#FFD36B", accent: "#FF6B57", onFlame: "#FFFFFF" };
  return { level: 0, flame: "#FF6B1A", stroke: "#C8261A", inner: "#FFC23D", core: "#FFF1C4", accent: "#FFC23D", onFlame: "#160A04" };
}
