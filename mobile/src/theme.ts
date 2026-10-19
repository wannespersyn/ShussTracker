/**
 * Theme tokens
 *
 * The website's "Scoreboard" design tokens (app/globals.css, dark theme)
 * for React Native StyleSheets: colors, font family names and radii.
 */
export const colors = {
  ink: "#111111",
  surface: "#0b0d0c",
  raised: "#1d2224",
  deep: "#15191a",
  panel: "#15191a",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.12)",
  gold: "#ffb627",
  red: "#ff6b5b",
  redPale: "#ff8a7c",
  mint: "#7fe0a8",
  cream: "#f3f1ea",
  muted: "#9aa19c",
  soft: "#c9cec9",
  chip: "#2a3033",
  dim: "#6b746f",
} as const;

/** Loaded in app/_layout.tsx from @expo-google-fonts. */
export const fonts = {
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodySemi: "Barlow_600SemiBold",
  bodyBold: "Barlow_700Bold",
  headSemi: "BarlowCondensed_600SemiBold",
  headBold: "BarlowCondensed_700Bold",
  display: "BarlowCondensed_800ExtraBold",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
