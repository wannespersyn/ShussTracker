/**
 * Shussapp Beta — feature registry and pure helpers.
 *
 * The beta is opt-in per person (Settings › Beta). Every beta feature is
 * listed here once; Settings, the explainer pages, the feedback sheet and
 * the admin view all read from this list, and feature code gates itself
 * with `hasBeta(userId, key)` from lib/db/beta.ts. Copy lives in
 * `t.beta.features[key]`. Client-safe: no DB access in this file.
 */

export const BETA_FEATURES = [
  { key: "wrapped", addedAt: "2026-10-23", tone: "gold" },
  { key: "start", addedAt: "2026-10-23", tone: "orange" },
  { key: "celebrations", addedAt: "2026-10-23", tone: "red" },
  { key: "mat", addedAt: "2026-10-24", tone: "gold" },
] as const;

export type BetaKey = (typeof BETA_FEATURES)[number]["key"];
export type BetaTone = (typeof BETA_FEATURES)[number]["tone"];

/** Feedback rows about the beta as a whole (e.g. a leave reason) use this
 * instead of a feature key. */
export const BETA_GENERAL = "beta";

export const BETA_TAGS = ["tooLong", "tooFast", "wrongNumber", "spotOn", "wantMore", "shareBroken"] as const;
export type BetaTag = (typeof BETA_TAGS)[number];

export const BETA_LEAVE_REASONS = ["bugs", "tooLong", "preferNormal", "other"] as const;
export type BetaLeaveReason = (typeof BETA_LEAVE_REASONS)[number];

export type BetaState = { optIn: boolean; joinedAt: Date | null; disabled: string[] };

export function isBetaKey(value: unknown): value is BetaKey {
  return BETA_FEATURES.some((f) => f.key === value);
}

export function betaEnabled(state: BetaState, key: BetaKey): boolean {
  return state.optIn && !state.disabled.includes(key);
}

/** Features added after the user last joined (all of them if they never
 * joined) — drives the "N NEW" badge in Settings. */
export function newBetaCount(state: BetaState): number {
  if (!state.optIn || !state.joinedAt) return BETA_FEATURES.length;
  const joined = state.joinedAt.getTime();
  return BETA_FEATURES.filter((f) => new Date(f.addedAt).getTime() > joined).length;
}
