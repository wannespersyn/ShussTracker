/**
 * JS-side mirror of app/globals.css design tokens, for values components
 * need to compute rather than apply as a class (e.g. picking a cap-ring
 * gradient pair per avatar, or a recap slide's color set).
 * Keep in sync with app/globals.css by hand — CSS is the source of truth.
 */

/** Bottle-cap avatar ring: repeating-conic-gradient light/dark pairs. */
export const capRingPairs = {
  gold: { light: "#F2B01E", dark: "#C07C0A" },
  red: { light: "#E5352B", dark: "#9C1F19" },
  cream: { light: "#F6EFDD", dark: "#B9AF95" },
  mint: { light: "#5CC8A0", dark: "#2E7A5F" },
} as const;

export type CapRingColor = keyof typeof capRingPairs;

/** `background` value for a bottle-cap avatar ring: fine gold-on-dark sunburst
 * ridges (thin light spokes over the dark fill), like an embossed crown cap. */
export function capRingGradient(color: CapRingColor) {
  const { light, dark } = capRingPairs[color];
  return `repeating-conic-gradient(from 0deg, ${light} 0deg 1.6deg, ${dark} 1.6deg 8.18deg)`;
}

/** Crimped crown-cap silhouette (22 scallops) as a CSS `clip-path` polygon,
 * shared by every bottle-cap ring so the shape stays in sync app-wide. */
export const capCrownClipPath = (() => {
  const scallops = 22;
  const steps = 220;
  const baseRadius = 47;
  const amplitude = 3;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const radius = baseRadius + amplitude * Math.cos(angle * scallops);
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${points.join(", ")})`;
})();

/** Season recap "story" slide color sets — background/accent/text/button swap per slide. */
export const recapSlideThemes = {
  showedUp: {
    background: "radial-gradient(120% 120% at 50% 0%, #15493A 0%, #0B2620 55%, #081A15 100%)",
    accent: "#F2B01E",
    text: "#F6EFDD",
    buttonBg: "#F2B01E",
    buttonFg: "#0B2620",
    buttonShadow: "#A96C05",
  },
  biggestWin: {
    background: "radial-gradient(120% 120% at 50% 0%, #8E1610 0%, #5B0D09 55%, #081A15 100%)",
    accent: "#F2B01E",
    text: "#F6EFDD",
    buttonBg: "#F2B01E",
    buttonFg: "#0B2620",
    buttonShadow: "#A96C05",
  },
  bestDuo: {
    background: "linear-gradient(165deg, #F2B01E, #B87A06)",
    accent: "#0B2620",
    text: "#0B2620",
    buttonBg: "#0B2620",
    buttonFg: "#F6EFDD",
    buttonShadow: "rgba(0,0,0,.35)",
  },
  redZones: {
    background: "radial-gradient(120% 120% at 50% 0%, #15493A 0%, #0B2620 55%, #081A15 100%)",
    accent: "#E5352B",
    text: "#F6EFDD",
    buttonBg: "#F2B01E",
    buttonFg: "#0B2620",
    buttonShadow: "#A96C05",
  },
} as const;

export type RecapSlide = keyof typeof recapSlideThemes;

/** Display-hero numbers used once per screen — deliberately not part of the
 * generic type scale in globals.css (`--text-display-*`). */
export const displayHero = {
  seasonRecapStat: 132,
  homeWinRate: 86,
  notificationClock: 82,
  shareCardScore: 78,
  h2hWinCount: 64,
  onboardingWordmark: 60,
  logGamePlayerTile: 56,
} as const;

/** Split-flap `roll` animation durations, staggered per stat (ms). */
export const splitFlapDurations = {
  winRate: 1500,
  streak: 1700,
  riskZone: 1900,
} as const;

/** Toast auto-dismiss duration (ms). */
export const toastDurationMs = 1900;
