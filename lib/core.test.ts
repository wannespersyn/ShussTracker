/**
 * Core helper tests
 *
 * Elo, Wilson ranking, shot scoring, streak tiers and the camera's
 * whole-field bookkeeping.
 */
import { describe, expect, it } from "vitest";
import { ELO_BASE, computeEloHistory, computeEloRatings, type EloGame } from "@/lib/elo";
import { wilsonLowerBound } from "@/lib/ranking";
import { scoreForPlayers, scoreForShots } from "@/lib/scoring";
import { streakTier } from "@/lib/streak-tier";
import { fieldDiff, nextField } from "@/lib/camera-field";

const g = (day: number, winners: string[], losers: string[]): EloGame & { id: string } => ({
  id: `g${day}`,
  playedAt: new Date(2026, 0, day),
  teams: [
    { playerIds: winners, finalRank: 1 },
    { playerIds: losers, finalRank: 2 },
  ],
});

describe("Elo", () => {
  it("is zero-sum and starts at the base rating", () => {
    const r = computeEloRatings([g(1, ["a", "b"], ["c", "d"])]);
    const total = ["a", "b", "c", "d"].reduce((s, id) => s + r.get(id)!.rating, 0);
    expect(total).toBeCloseTo(4 * ELO_BASE, 6);
    expect(r.get("a")!.rating).toBeGreaterThan(ELO_BASE);
    expect(r.get("c")!.gamesPlayed).toBe(1);
  });

  it("processes games in time order, whatever order they come in", () => {
    const games = [g(2, ["c", "d"], ["a", "b"]), g(1, ["a", "b"], ["c", "d"])];
    const a = computeEloRatings(games);
    const b = computeEloRatings([...games].reverse());
    expect(a.get("a")!.rating).toBeCloseTo(b.get("a")!.rating, 9);
  });

  it("an upset moves ratings more than an expected win", () => {
    const warm = [g(1, ["a", "b"], ["c", "d"]), g(2, ["a", "b"], ["c", "d"])];
    const expected = computeEloHistory([...warm, g(3, ["a", "b"], ["c", "d"])]).get("a")!.at(-1)!.delta;
    const upset = computeEloHistory([...warm, g(3, ["c", "d"], ["a", "b"])]).get("c")!.at(-1)!.delta;
    expect(upset).toBeGreaterThan(expected);
  });

  it("ignores games without a result", () => {
    const r = computeEloRatings([{ playedAt: new Date(), teams: [{ playerIds: ["a"], finalRank: null }, { playerIds: ["b"], finalRank: 1 }] }]);
    expect(r.size).toBe(0);
  });
});

describe("wilsonLowerBound", () => {
  it("ranks 27/30 above 1/1", () => {
    expect(wilsonLowerBound(27, 30)).toBeGreaterThan(wilsonLowerBound(1, 1));
  });
  it("is 0 without games and stays within 0–1", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(50, 50)).toBeLessThanOrEqual(1);
  });
});

describe("scoring", () => {
  it("sums zone values; mama and miss score nothing", () => {
    expect(scoreForShots([{ fieldHit: "3" }, { fieldHit: "mama" }, { fieldHit: "miss" }, { fieldHit: "1" }])).toBe(4);
  });
  it("own goals go to the other team", () => {
    const us = [{ shots: [{ fieldHit: "2" }] }];
    const them = [{ shots: [{ fieldHit: "3", ownGoal: true }] }];
    expect(scoreForPlayers(us, them)).toBe(5);
    expect(scoreForPlayers(them, us)).toBe(0);
  });
});

describe("streakTier", () => {
  it.each([
    [3, 0],
    [5, 1],
    [8, 2],
    [12, 3],
  ])("%i wins in a row → level %i", (n, level) => {
    expect(streakTier(n).level).toBe(level);
  });
});

describe("camera field", () => {
  it("removes knocked caps and adds landed ones", () => {
    const after = nextField([{ x: 100, y: 100 }, { x: 300, y: 100 }], [{ x: 500, y: 120 }], [{ x: 105, y: 98 }], null);
    expect(after).toEqual([{ x: 300, y: 100 }, { x: 500, y: 120 }]);
  });
  it("drops caps the camera no longer sees", () => {
    expect(nextField([{ x: 100, y: 100 }], [], [], [])).toEqual([]);
  });
  it("a landing on an existing cap is the same cap", () => {
    expect(nextField([{ x: 100, y: 100 }], [{ x: 110, y: 100 }], [], null)).toHaveLength(1);
  });
  it("fieldDiff reports what moved", () => {
    expect(fieldDiff([{ x: 0, y: 0 }], [{ x: 200, y: 0 }])).toEqual({ spots: [{ x: 200, y: 0 }], gone: [{ x: 0, y: 0 }] });
  });
});
