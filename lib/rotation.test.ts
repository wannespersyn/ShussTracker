/**
 * Americano / Mexicano tests
 *
 * Planning (partners rotate, byes spread evenly), standings and tie-breakers,
 * the sip balance and which games fit on the mats.
 */
import { describe, expect, it } from "vitest";
import {
  fullRotationRounds,
  onTheMats,
  parseTiebreaks,
  planAmericano,
  planMexicanoRound,
  rotationStandings,
  sipBalance,
  type RotationGameResult,
} from "@/lib/rotation";

/** Deterministic random numbers so plans are reproducible. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const key = (a: string, b: string) => [a, b].sort().join("|");

describe("planAmericano", () => {
  it("8 players: everyone plays with 7 different partners in 7 rounds (mostly)", () => {
    const players = ids(8);
    const rounds = planAmericano(players, fullRotationRounds(8), seeded());
    expect(rounds).toHaveLength(7);
    const partners = new Map<string, number>();
    for (const r of rounds) {
      expect(r.games).toHaveLength(2);
      expect(r.byes).toEqual([]);
      for (const g of r.games) for (const d of [g.a, g.b]) partners.set(key(d[0], d[1]), (partners.get(key(d[0], d[1])) ?? 0) + 1);
    }
    // 28 possible duos, 28 duo slots: the greedy plan repeats very few.
    expect(partners.size).toBeGreaterThanOrEqual(24);
  });

  it("every player is in exactly one game or on a bye each round", () => {
    const players = ids(10);
    for (const r of planAmericano(players, 5, seeded(7))) {
      const seen = [...r.byes, ...r.games.flatMap((g) => [...g.a, ...g.b])];
      expect(seen.sort()).toEqual([...players].sort());
      expect(r.byes).toHaveLength(2);
    }
  });

  it("byes are spread evenly", () => {
    const players = ids(5);
    const byes = new Map<string, number>();
    for (const r of planAmericano(players, 5, seeded(3))) for (const b of r.byes) byes.set(b, (byes.get(b) ?? 0) + 1);
    expect([...byes.values()]).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("planMexicanoRound", () => {
  it("#1 + #4 vs #2 + #3", () => {
    const r = planMexicanoRound(["a", "b", "c", "d"], [], [], seeded());
    expect(r.games[0]).toEqual({ a: ["a", "d"], b: ["b", "c"] });
  });

  it("avoids repeating last round's duos", () => {
    const r = planMexicanoRound(["a", "b", "c", "d"], [{ a: ["a", "d"], b: ["b", "c"] }], [[]], seeded());
    expect(r.games[0]).toEqual({ a: ["a", "c"], b: ["b", "d"] });
  });
});

describe("rotationStandings", () => {
  const game = (a: [string, string], b: [string, string], aWon: boolean, extra: Partial<RotationGameResult> = {}): RotationGameResult => ({
    a,
    b,
    round: 1,
    aWon,
    ...extra,
  });

  it("sorts by win %, then the chosen tie-breakers", () => {
    const players = ["a", "b", "c", "d"];
    const games = [
      game(["a", "b"], ["c", "d"], true, { mama: { a: 1 } }),
      game(["a", "c"], ["b", "d"], false, { mama: { b: 2 } }),
    ];
    const s = rotationStandings(players, games, []);
    expect(s.map((x) => x.userId)).toEqual(["b", "a", "d", "c"]);
    expect(s[0]).toMatchObject({ wins: 2, losses: 0, winPct: 100, mama: 2, partners: 2 });
  });

  it("sip balance breaks a tie when it comes first", () => {
    const players = ["a", "b", "c", "d"];
    const games = [game(["a", "b"], ["c", "d"], true, { sips: { a: 5, b: 5, c: -5, d: -5 } }), game(["c", "d"], ["a", "b"], true, { sips: { c: 9, d: 9, a: -9, b: -9 } })];
    const s = rotationStandings(players, games, [], parseTiebreaks("sips"));
    expect(s.slice(0, 2).map((x) => x.userId).sort()).toEqual(["c", "d"]);
    expect(s[0].sips).toBe(4);
  });

  it("unplayed games don't count", () => {
    const s = rotationStandings(["a", "b", "c", "d"], [{ a: ["a", "b"], b: ["c", "d"], round: 1, aWon: null }], []);
    expect(s.every((x) => x.games === 0)).toBe(true);
  });
});

describe("parseTiebreaks", () => {
  it("drops unknown keys and appends missing ones (old tournaments get sips last)", () => {
    expect(parseTiebreaks("wins,bogus,pct")).toEqual(["wins", "pct", "mama", "sips", "elo"]);
    expect(parseTiebreaks("pct,wins,mama,elo")).toEqual(["pct", "wins", "mama", "elo", "sips"]);
    expect(parseTiebreaks(null)).toEqual(["pct", "wins", "mama", "sips", "elo"]);
  });
});

describe("sipBalance", () => {
  const rounds = [
    { complete: true, jokerTeamId: null, teams: [{ gameTeamId: "A", sips: 3 }, { gameTeamId: "B", sips: 5 }] },
    { complete: true, jokerTeamId: "A", teams: [{ gameTeamId: "A", sips: 6 }, { gameTeamId: "B", sips: 0 }] },
    { complete: false, jokerTeamId: null, teams: [{ gameTeamId: "A", sips: 9 }, { gameTeamId: "B", sips: 0 }] },
  ];
  it("handed out minus drunk, skipping joker and unfinished rounds", () => {
    expect(sipBalance(rounds, "A")).toBe(2);
    expect(sipBalance(rounds, "B")).toBe(-2);
  });
  it("null without a mat log", () => {
    expect(sipBalance([], "A")).toBeNull();
  });
});

describe("onTheMats", () => {
  it("never puts a player on two mats", () => {
    const g = (a: [string, string], b: [string, string]) => ({ a, b, played: false });
    const { now, queue } = onTheMats([g(["a", "b"], ["c", "d"]), g(["a", "e"], ["f", "g"]), g(["e", "f"], ["g", "h"])], 2);
    expect(now).toHaveLength(2);
    expect(queue).toHaveLength(1);
    expect(now[1].a).toEqual(["e", "f"]);
  });
});
