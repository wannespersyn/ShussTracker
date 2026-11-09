/**
 * Stats layout
 *
 * The player-built stats page: screens (swipe between them) holding blocks
 * of a kind and a size. This file is the catalog of block kinds, the
 * templates for a new screen, the default layout and the validator that
 * every saved layout goes through.
 *
 * Data: plain JSON, stored per user (lib/db/stats-layout.ts).
 */

export type StatsBlockSize = "S" | "M" | "L";
export type StatsBlockKind =
  | "elo"
  | "winPct"
  | "games"
  | "kruipen"
  | "mamas"
  | "form"
  | "nights"
  | "bestPartner"
  | "partners"
  | "mamaRate"
  | "bestGame"
  | "mamaStreak"
  | "streak"
  | "h2h"
  | "records"
  | "crewMama"
  | "crewRanking";
export type StatsBlockCategory = "elo" | "mama" | "duo" | "crew" | "nights";

export type StatsBlock = { id: string; kind: StatsBlockKind; size: StatsBlockSize };
export type StatsScreen = { id: string; name: string; blocks: StatsBlock[] };
export type StatsLayout = { v: 1; screens: StatsScreen[] };

/** Every block kind: which sizes it supports (first = default), its
 * category in the library, and whether it's a Crew Pro block (labelled
 * only — no paywall yet). S = half width, M = full width, L = full width
 * and taller / more rows. */
export const BLOCKS: Record<StatsBlockKind, { sizes: StatsBlockSize[]; cat: StatsBlockCategory; pro?: boolean }> = {
  elo: { sizes: ["L", "M"], cat: "elo" },
  winPct: { sizes: ["S", "M"], cat: "elo" },
  games: { sizes: ["S", "M"], cat: "elo" },
  streak: { sizes: ["S", "M"], cat: "elo" },
  kruipen: { sizes: ["S", "M"], cat: "crew" },
  mamas: { sizes: ["S", "M"], cat: "mama" },
  mamaRate: { sizes: ["M", "S"], cat: "mama" },
  bestGame: { sizes: ["S", "M"], cat: "mama" },
  mamaStreak: { sizes: ["S", "M"], cat: "mama" },
  form: { sizes: ["M", "L"], cat: "nights" },
  nights: { sizes: ["M", "L"], cat: "nights" },
  bestPartner: { sizes: ["S", "M"], cat: "duo" },
  partners: { sizes: ["M", "L"], cat: "duo", pro: true },
  h2h: { sizes: ["M", "S", "L"], cat: "duo" },
  records: { sizes: ["M", "L"], cat: "crew" },
  crewMama: { sizes: ["M", "L"], cat: "mama" },
  crewRanking: { sizes: ["M", "L"], cat: "crew", pro: true },
};
export const BLOCK_KINDS = Object.keys(BLOCKS) as StatsBlockKind[];

export const MAX_SCREENS = 10;
export const MAX_BLOCKS = 16;
export const MAX_SCREEN_NAME = 24;

export type StatsTemplate = "empty" | "overview" | "mama" | "duos" | "rivals" | "nights";
export const TEMPLATES: Record<StatsTemplate, [StatsBlockKind, StatsBlockSize][]> = {
  empty: [],
  overview: [["elo", "L"], ["winPct", "S"], ["kruipen", "S"], ["form", "M"], ["mamas", "S"], ["bestPartner", "S"]],
  mama: [["mamaRate", "M"], ["bestGame", "S"], ["mamaStreak", "S"], ["crewMama", "M"]],
  duos: [["partners", "L"], ["bestPartner", "S"], ["streak", "S"]],
  rivals: [["h2h", "L"], ["crewRanking", "M"]],
  nights: [["form", "L"], ["nights", "M"], ["games", "S"], ["streak", "S"]],
};

let seq = 0;
/** Short unique-enough id for a block or screen. */
export function newId(prefix: string): string {
  seq = (seq + 1) % 1000;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function blocksFrom(t: StatsTemplate): StatsBlock[] {
  return TEMPLATES[t].map(([kind, size]) => ({ id: newId("b"), kind, size }));
}

/** First layout for someone who never edited theirs. Names are filled in by
 * the client from the dictionary when empty. */
export function defaultLayout(names: { overview: string; mama: string; duos: string }): StatsLayout {
  return {
    v: 1,
    screens: [
      { id: "s-overview", name: names.overview, blocks: TEMPLATES.overview.map(([kind, size], i) => ({ id: `b-o${i}`, kind, size })) },
      { id: "s-mama", name: names.mama, blocks: TEMPLATES.mama.map(([kind, size], i) => ({ id: `b-m${i}`, kind, size })) },
      { id: "s-duos", name: names.duos, blocks: TEMPLATES.duos.map(([kind, size], i) => ({ id: `b-d${i}`, kind, size })) },
    ],
  };
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** Validates untrusted JSON into a layout: unknown kinds and bad ids are
 * dropped, sizes snap to the kind's default, names are trimmed and capped,
 * duplicate ids removed. Returns null when nothing usable is left. */
export function sanitizeLayout(input: unknown): StatsLayout | null {
  if (!input || typeof input !== "object") return null;
  const raw = (input as { screens?: unknown }).screens;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const screens: StatsScreen[] = [];
  for (const s of raw.slice(0, MAX_SCREENS)) {
    if (!s || typeof s !== "object") continue;
    const { id, name, blocks } = s as { id?: unknown; name?: unknown; blocks?: unknown };
    if (typeof id !== "string" || !ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const clean: StatsBlock[] = [];
    for (const b of Array.isArray(blocks) ? blocks.slice(0, MAX_BLOCKS) : []) {
      if (!b || typeof b !== "object") continue;
      const { id: bid, kind, size } = b as { id?: unknown; kind?: unknown; size?: unknown };
      if (typeof bid !== "string" || !ID.test(bid) || seen.has(bid)) continue;
      if (typeof kind !== "string" || !(kind in BLOCKS)) continue;
      const def = BLOCKS[kind as StatsBlockKind];
      seen.add(bid);
      clean.push({ id: bid, kind: kind as StatsBlockKind, size: def.sizes.includes(size as StatsBlockSize) ? (size as StatsBlockSize) : def.sizes[0] });
    }
    screens.push({ id, name: typeof name === "string" ? name.trim().slice(0, MAX_SCREEN_NAME) : "", blocks: clean });
  }
  return screens.length ? { v: 1, screens } : null;
}
