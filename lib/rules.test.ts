/**
 * Crew rules tests
 *
 * parseRuleset must turn anything stored or posted into a valid ruleset,
 * falling back to the game's defaults.
 */
import { describe, expect, it } from "vitest";
import { GAME_DEFAULTS, houseRules, parseRuleset } from "@/lib/rules";

describe("parseRuleset", () => {
  it("null or garbage → Leberschuss defaults", () => {
    expect(parseRuleset(null)).toEqual(GAME_DEFAULTS.leberschuss);
    expect(parseRuleset("nope")).toEqual(GAME_DEFAULTS.leberschuss);
    expect(parseRuleset({ game: "darts" })).toEqual(GAME_DEFAULTS.leberschuss);
  });

  it("a game alone gives that game's defaults", () => {
    expect(parseRuleset({ game: "beertoss" })).toEqual(GAME_DEFAULTS.beertoss);
  });

  it("keeps valid house rules and drops invalid ones", () => {
    const r = parseRuleset({ game: "leberschuss", jokers: 2, emptyRoundsForAll: null, shootingBoxBonus: "yes", centerZone: "reset" });
    expect(r).toMatchObject({ jokers: 2, emptyRoundsForAll: null, shootingBoxBonus: true, centerZone: "reset" });
  });

  it("rejects out-of-range numbers", () => {
    expect(parseRuleset({ jokers: 9 }).jokers).toBe(1);
    expect(parseRuleset({ jokers: -1 }).jokers).toBe(1);
    expect(parseRuleset({ emptyRoundsForAll: 7 }).emptyRoundsForAll).toBe(3);
  });

  it("the theme can differ from the game", () => {
    expect(parseRuleset({ game: "leberschuss", theme: "beertoss" }).theme).toBe("beertoss");
  });
});

describe("houseRules", () => {
  it("lists what differs from the game's defaults", () => {
    expect(houseRules(GAME_DEFAULTS.beertoss)).toEqual([]);
    expect(houseRules({ ...GAME_DEFAULTS.leberschuss, jokers: 0, theme: "beertoss" })).toEqual(["theme", "jokers"]);
  });
});
