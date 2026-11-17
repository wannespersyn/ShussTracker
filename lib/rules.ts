/**
 * Crew rules
 *
 * Which game a crew plays (Leberschuss or BeerToss), its look, and the house
 * rules it changed. Stored per crew as JSON (`group.rules`); `null` or a
 * partial object falls back to the game's defaults, so old crews keep
 * playing Leberschuss exactly as before.
 *
 * Exports: Ruleset, GameKind, GAME_DEFAULTS, parseRuleset, rulesFor, sameRules
 * Notes: pure, shared by the web app, the Expo app (@shared) and the API.
 */

export type GameKind = "leberschuss" | "beertoss";
export const GAMES: GameKind[] = ["leberschuss", "beertoss"];

/** What a cap in the zone at either end does. */
export type CenterZone =
  /** Leberschuss: that team empties its pint and takes 2 new ones; nobody sips. */
  | "mama"
  /** BeerToss: that team empties its drink and takes a new one; the mat doesn't count. */
  | "reset";

export type Ruleset = {
  game: GameKind;
  /** Look of the app for this crew; follows the game unless changed. */
  theme: GameKind;
  /** Jokers per team per game (0 = no jokers). */
  jokers: number;
  /** Rounds in a row with nothing to drink before everyone drinks ad fundum (null = off). */
  emptyRoundsForAll: number | null;
  /** A cap shot into a shooting box gives that player an extra throw at the end of the round. */
  shootingBoxBonus: boolean;
  /** A thrown cap that lands upside down doubles the sips it scores. */
  upsideDownDoubles: boolean;
  centerZone: CenterZone;
};

export const GAME_DEFAULTS: Record<GameKind, Ruleset> = {
  leberschuss: {
    game: "leberschuss",
    theme: "leberschuss",
    jokers: 1,
    emptyRoundsForAll: 3,
    shootingBoxBonus: true,
    upsideDownDoubles: false,
    centerZone: "mama",
  },
  beertoss: {
    game: "beertoss",
    theme: "beertoss",
    jokers: 1,
    emptyRoundsForAll: null,
    shootingBoxBonus: false,
    upsideDownDoubles: true,
    centerZone: "reset",
  },
};

export const MAX_JOKERS = 3;
export const EMPTY_ROUND_CHOICES = [2, 3, 4, 5] as const;

const isGame = (v: unknown): v is GameKind => v === "leberschuss" || v === "beertoss";

/** Turn whatever is stored (or posted) into a complete, valid ruleset. Unknown
 * or out-of-range values fall back to the game's default. */
export function parseRuleset(raw: unknown): Ruleset {
  const r = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const game = isGame(r.game) ? r.game : "leberschuss";
  const d = GAME_DEFAULTS[game];
  const jokers = typeof r.jokers === "number" && Number.isInteger(r.jokers) && r.jokers >= 0 && r.jokers <= MAX_JOKERS ? r.jokers : d.jokers;
  const empty =
    r.emptyRoundsForAll === null
      ? null
      : typeof r.emptyRoundsForAll === "number" && (EMPTY_ROUND_CHOICES as readonly number[]).includes(r.emptyRoundsForAll)
        ? r.emptyRoundsForAll
        : d.emptyRoundsForAll;
  return {
    game,
    theme: isGame(r.theme) ? r.theme : d.theme,
    jokers,
    emptyRoundsForAll: empty,
    shootingBoxBonus: typeof r.shootingBoxBonus === "boolean" ? r.shootingBoxBonus : d.shootingBoxBonus,
    upsideDownDoubles: typeof r.upsideDownDoubles === "boolean" ? r.upsideDownDoubles : d.upsideDownDoubles,
    centerZone: r.centerZone === "mama" || r.centerZone === "reset" ? r.centerZone : d.centerZone,
  };
}

/** A fresh copy of a game's default rules. */
export const rulesFor = (game: GameKind): Ruleset => ({ ...GAME_DEFAULTS[game] });

/** True when the crew plays a game's rules unchanged. */
export function sameRules(a: Ruleset, b: Ruleset): boolean {
  return (Object.keys(a) as (keyof Ruleset)[]).every((k) => a[k] === b[k]);
}

/** Rules that differ from the game's defaults ("house rules"), for a short summary. */
export function houseRules(r: Ruleset): (keyof Ruleset)[] {
  const d = GAME_DEFAULTS[r.game];
  return (Object.keys(r) as (keyof Ruleset)[]).filter((k) => k !== "game" && r[k] !== d[k]);
}
