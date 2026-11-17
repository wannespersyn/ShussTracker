/**
 * Mat engine tests
 *
 * Plays rounds on the mat logger engine (lib/mat.ts) and checks the
 * settlement under Leberschuss defaults and under crew house rules.
 */
import { describe, expect, it } from "vitest";
import {
  CORNERS,
  MAMAS,
  ZONES,
  finishThrow,
  jokersLeft,
  newMatState,
  nextRound,
  playJoker,
  toGameLog,
  toggleFlip,
  turnInfo,
  type MatState,
} from "@/lib/mat";
import { GAME_DEFAULTS, type Ruleset } from "@/lib/rules";

type Pt = { x: number; y: number };
const centroid = (pts: [number, number][]): Pt => ({
  x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
  y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
});
const zone = (id: string) => centroid(ZONES.find((z) => z.id === id)!.pts);
const mama = (id: string): Pt => {
  const m = MAMAS.find((x) => x.id === id)!;
  return { x: m.x + m.w / 2, y: m.y + m.h / 2 };
};
const NOWHERE: Pt = { x: 412, y: 132 };

/** Put the current thrower's cap at `p` and commit the throw. */
function throwTo(st: MatState, p: Pt | "miss") {
  if (p === "miss") return expect(finishThrow(st, true)).toBe(true);
  const cap = st.caps.find((c) => c.no === st.activeCap)!;
  Object.assign(cap, { x: Math.round(p.x), y: Math.round(p.y), waiting: false });
  expect(finishThrow(st, false)).toBe(true);
}

const solo = (rules?: Partial<Ruleset>) => newMatState(true, "TR", rules ? { ...GAME_DEFAULTS.leberschuss, ...rules } : undefined);

describe("mat engine — Leberschuss defaults", () => {
  it("a solo round is A1 then B1, then settles", () => {
    const st = solo();
    expect(st.thrower).toBe("a1");
    throwTo(st, NOWHERE);
    expect(st.thrower).toBe("b1");
    throwTo(st, NOWHERE);
    expect(st.phase).toBe("done");
    expect(st.results).toHaveLength(1);
  });

  it("zones at team A's end score for team B and vice versa", () => {
    const st = solo();
    throwTo(st, zone("L3")); // A's end (A1 = TR → top = L side) → counts for B
    throwTo(st, zone("R2"));
    expect(st.results[0].sips).toEqual([2, 3]);
  });

  it("a mama cancels all sips and names the team at that end", () => {
    const st = solo();
    throwTo(st, zone("R3"));
    throwTo(st, mama("ML"));
    expect(st.results[0]).toMatchObject({ sips: [0, 0], mamaTeams: [0] });
  });

  it("three empty rounds in a row make everyone drink ad fundum", () => {
    const st = solo();
    for (let r = 1; r <= 3; r++) {
      throwTo(st, NOWHERE);
      throwTo(st, NOWHERE);
      if (r < 3) nextRound(st);
    }
    expect(st.results.map((r) => r.allDrink)).toEqual([false, false, true]);
  });

  it("a cap shot into a shooting box earns its owner an extra throw", () => {
    const st = solo();
    throwTo(st, centroid(CORNERS.BL.pts)); // B1's corner when A1 starts top-right
    throwTo(st, NOWHERE);
    expect(turnInfo(st).next).toBe("b1");
    expect(st.phase).toBe("throw");
  });

  it("one joker per team per game", () => {
    const st = solo();
    throwTo(st, zone("R1"));
    throwTo(st, NOWHERE);
    expect(playJoker(st, 1)).toBe(true);
    nextRound(st);
    throwTo(st, zone("R1"));
    throwTo(st, NOWHERE);
    expect(playJoker(st, 1)).toBe(false);
    expect(jokersLeft(st, 0)).toBe(1);
  });

  it("upside-down caps don't exist in Leberschuss", () => {
    const st = solo();
    throwTo(st, zone("R3"));
    expect(toggleFlip(st, st.caps[0].no)).toBe(false);
  });

  it("states saved before house rules play Leberschuss", () => {
    const st = solo();
    delete st.rules;
    throwTo(st, NOWHERE);
    throwTo(st, NOWHERE);
    expect(st.results[0].emptyStreak).toBe(1);
    expect(jokersLeft(st, 0)).toBe(1);
  });
});

describe("mat engine — house rules", () => {
  it("ad fundum can be switched off", () => {
    const st = solo({ emptyRoundsForAll: null });
    for (let r = 1; r <= 4; r++) {
      throwTo(st, NOWHERE);
      throwTo(st, NOWHERE);
      if (r < 4) nextRound(st);
    }
    expect(st.results.some((r) => r.allDrink)).toBe(false);
  });

  it("ad fundum after 2 empty rounds", () => {
    const st = solo({ emptyRoundsForAll: 2 });
    throwTo(st, NOWHERE);
    throwTo(st, NOWHERE);
    nextRound(st);
    throwTo(st, NOWHERE);
    throwTo(st, NOWHERE);
    expect(st.results[1].allDrink).toBe(true);
  });

  it("no bonus throw when the shooting-box rule is off", () => {
    const st = solo({ shootingBoxBonus: false });
    throwTo(st, centroid(CORNERS.BL.pts));
    throwTo(st, NOWHERE);
    expect(st.phase).toBe("done");
  });

  it("two jokers per team when the crew allows it", () => {
    const st = solo({ jokers: 2 });
    for (let r = 1; r <= 2; r++) {
      throwTo(st, zone("R1"));
      throwTo(st, NOWHERE);
      expect(playJoker(st, 0)).toBe(true);
      nextRound(st);
    }
    expect(jokersLeft(st, 0)).toBe(0);
  });

  it("no jokers at all", () => {
    const st = solo({ jokers: 0 });
    throwTo(st, zone("R1"));
    throwTo(st, NOWHERE);
    expect(playJoker(st, 0)).toBe(false);
  });

  it("BeerToss: an upside-down cap doubles its sips, once", () => {
    const st = newMatState(true, "TR", GAME_DEFAULTS.beertoss);
    const cap = st.caps.find((c) => c.no === st.activeCap)!;
    Object.assign(cap, { ...zone("R3"), waiting: false });
    expect(toggleFlip(st, cap.no)).toBe(true);
    expect(finishThrow(st, false)).toBe(true);
    throwTo(st, zone("L1"));
    expect(st.results[0].sips).toEqual([6, 1]);
    const log = toGameLog(st, { a1: "p1", b1: "p2", a2: undefined, b2: undefined }, 0);
    expect(log.rounds[0].throws[0].flipped).toBe(true);
    expect(log.rules?.game).toBe("beertoss");
  });

  it("a missed throw is never upside down", () => {
    const st = newMatState(true, "TR", GAME_DEFAULTS.beertoss);
    const cap = st.caps.find((c) => c.no === st.activeCap)!;
    Object.assign(cap, { ...zone("R3"), waiting: false });
    toggleFlip(st, cap.no);
    throwTo(st, "miss");
    expect(st.throws[0].flipped).toBeUndefined();
  });
});
