/**
 * JS-side mirror of app/globals.css design tokens, for values components
 * need to compute rather than apply as a class (e.g. picking a cap-ring
 * gradient pair per avatar, or a recap slide's color set).
 * Keep in sync with app/globals.css by hand — CSS is the source of truth.
 */

/** Bottle-cap avatar ring: repeating-conic-gradient light/dark pairs, plus
 * the radial "face" gradient (photographic highlight) painted under the
 * glossy overlay inside the ring. */
export const capRingPairs = {
  gold: { light: "#F4D488", dark: "#A3781A", face: "radial-gradient(circle at 34% 26%,#ffeeb8,#d8a72c 46%,#8f6b14 100%)", ink: "#3A2A05" },
  red: { light: "#E6A4A0", dark: "#8D3A34", face: "radial-gradient(circle at 34% 26%,#ffd6d2,#c8544b 46%,#7d2a24 100%)", ink: "#2B0D0A" },
  cream: { light: "#DFE3DC", dark: "#7C857C", face: "radial-gradient(circle at 34% 26%,#ffffff,#c3c9c1 46%,#79817a 100%)", ink: "#2B302C" },
  mint: { light: "#A8D2B7", dark: "#3C6B4D", face: "radial-gradient(circle at 34% 26%,#d9f3e2,#5a9a70 46%,#2e5a3f 100%)", ink: "#0C1F14" },
} as const;

export type CapRingColor = keyof typeof capRingPairs;

/** `background` value for a bottle-cap avatar ring: sunburst ridges (light
 * spokes over the dark fill) like an embossed crown cap. Matches the
 * mockup's 21-spoke repeat unit (17.143deg = 360deg / 21). */
export function capRingGradient(color: CapRingColor) {
  const { light, dark } = capRingPairs[color];
  return (
    `repeating-conic-gradient(from -8.571deg,` +
    `color-mix(in srgb,${dark},#000 26%) 0deg,${dark} 3.2deg,` +
    `${light} 7.6deg,color-mix(in srgb,${light},#fff 34%) 8.57deg,` +
    `${light} 9.6deg,${dark} 13.9deg,color-mix(in srgb,${dark},#000 26%) 17.143deg)`
  );
}

/** Glossy highlight overlay + radial "face" painted inside the ring —
 * gives the cap top a photographic highlight instead of a flat fill. */
export function capFaceGradient(color: CapRingColor) {
  return `linear-gradient(158deg,rgba(255,255,255,.34),rgba(255,255,255,.04) 40%,rgba(0,0,0,.16) 100%),${capRingPairs[color].face}`;
}

/** Dark ink color for initials/glyphs set directly on a cap's face. */
export function capInkColor(color: CapRingColor) {
  return capRingPairs[color].ink;
}

/** Season recap "story" slide color sets — background/accent/text/button swap
 * per slide. `buttonShadow` is a glow rgba (soft ambient shadow, no offset
 * "lip") rather than an offset-shadow color — see `--shadow-cta` in
 * app/globals.css. */
export const recapSlideThemes = {
  showedUp: {
    background: "radial-gradient(120% 120% at 50% 0%, #14201A 0%, #0B0F0C 55%, #0A0C0A 100%)",
    accent: "#E8B33C",
    text: "#EFE7D6",
    buttonBg: "#E8B33C",
    buttonFg: "#0A0C0A",
    buttonShadow: "rgba(232,179,60,.28)",
  },
  biggestWin: {
    background: "radial-gradient(120% 120% at 50% 0%, #6B1712 0%, #2C0A08 55%, #0A0C0A 100%)",
    accent: "#E8B33C",
    text: "#EFE7D6",
    buttonBg: "#E8B33C",
    buttonFg: "#0A0C0A",
    buttonShadow: "rgba(232,179,60,.28)",
  },
  bestDuo: {
    background: "linear-gradient(170deg, #E8B33C 0%, #C9992F 34%, #14201A 68%, #0B0F0C 100%)",
    accent: "#0A0C0A",
    text: "#0A0C0A",
    buttonBg: "#0A0C0A",
    buttonFg: "#EFE7D6",
    buttonShadow: "rgba(0,0,0,.35)",
  },
  redZones: {
    background: "radial-gradient(120% 120% at 50% 0%, #14201A 0%, #0B0F0C 55%, #0A0C0A 100%)",
    accent: "#E05B4E",
    text: "#EFE7D6",
    buttonBg: "#E8B33C",
    buttonFg: "#0A0C0A",
    buttonShadow: "rgba(232,179,60,.28)",
  },
} as const;

export type RecapSlide = keyof typeof recapSlideThemes;

/** Display-hero numbers used once per screen — deliberately not part of the
 * generic type scale in globals.css (`--text-display-*`). Values below are
 * confirmed from the "Shussapp Flow" mockup where that screen's frame was
 * captured; the rest carry over pending their screen's re-skin pass. */
export const displayHero = {
  seasonRecapStat: 132,
  homeWinRate: 76, // confirmed: home win-rate hero number
  notificationClock: 82,
  shareCardScore: 78,
  h2hWinCount: 34, // confirmed: H2H header score (much more compact than before)
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
