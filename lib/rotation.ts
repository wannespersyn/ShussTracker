/**
 * Rotation tournaments (Americano / Mexicano)
 *
 * Pure scheduling + ranking for "everybody plays with everybody" nights:
 * every round splits the active players into 2v2 games, sitting out the
 * remainder (byes, spread evenly). Americano rotates partners to minimise
 * repeats; Mexicano pairs by the current standings (#1+#4 vs #2+#3).
 *
 * Data: plain ids and results in, rounds and standings out — no DB access.
 */

export type RotationMode = "americano" | "mexicano";
/** One planned 2v2: team A and team B. */
export type RotationPairing = { a: [string, string]; b: [string, string] };
export type RotationRound = { games: RotationPairing[]; byes: string[] };
/** A planned game with its result once played (`aWon` null = not played). */
export type RotationGameResult = RotationPairing & {
  round: number;
  aWon: boolean | null;
  /** Per player in this game: mamas, and whether their team kruiped. */
  mama?: Record<string, number>;
  kruipA?: boolean;
  kruipB?: boolean;
  /** Elo change per player in this game. */
  elo?: Record<string, number>;
};

/** Rounds for a full rotation: with 4k players everyone partners everyone
 * once in n−1 rounds; otherwise n rounds (one bye-group per round). */
export function fullRotationRounds(n: number): number {
  if (n < 4) return 0;
  return n % 4 === 0 ? n - 1 : n;
}

/** Games in one round with `n` players. */
export const gamesPerRound = (n: number) => Math.floor(n / 4);

const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

type Counts = { partner: Map<string, number>; opponent: Map<string, number>; byes: Map<string, number> };

function countsFrom(games: RotationPairing[], byeRounds: string[][]): Counts {
  const partner = new Map<string, number>();
  const opponent = new Map<string, number>();
  const byes = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const g of games) {
    bump(partner, pairKey(g.a[0], g.a[1]));
    bump(partner, pairKey(g.b[0], g.b[1]));
    for (const x of g.a) for (const y of g.b) bump(opponent, pairKey(x, y));
  }
  for (const r of byeRounds) for (const id of r) bump(byes, id);
  return { partner, opponent, byes };
}

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Who sits out: the `m` players with the fewest byes so far (ties: the
 * `tiebreak` order, else random). */
function pickByes(players: string[], m: number, byes: Map<string, number>, rand: () => number, tiebreak?: string[]): string[] {
  if (m === 0) return [];
  const order = tiebreak ?? shuffled(players, rand);
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...players].sort((x, y) => (byes.get(x) ?? 0) - (byes.get(y) ?? 0) || (pos.get(x) ?? 0) - (pos.get(y) ?? 0)).slice(0, m);
}

/** The three ways to split a group of four into two duos. */
const SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

/** Americano round: many random tries, keep the one with the fewest partner
 * repeats (weighted heavily), then fewest opponent repeats. */
export function planAmericanoRound(players: string[], history: RotationPairing[], byeRounds: string[][], rand: () => number = Math.random): RotationRound {
  const c = countsFrom(history, byeRounds);
  const byes = pickByes(players, players.length % 4, c.byes, rand);
  const playing = players.filter((p) => !byes.includes(p));
  const cost = (g: RotationPairing) =>
    100 * ((c.partner.get(pairKey(g.a[0], g.a[1])) ?? 0) ** 2 + (c.partner.get(pairKey(g.b[0], g.b[1])) ?? 0) ** 2) +
    g.a.reduce((s, x) => s + g.b.reduce((t, y) => t + (c.opponent.get(pairKey(x, y)) ?? 0) ** 2, 0), 0);

  let best: { games: RotationPairing[]; cost: number } | null = null;
  const tries = Math.max(200, playing.length * 60);
  for (let k = 0; k < tries; k++) {
    const order = shuffled(playing, rand);
    const games: RotationPairing[] = [];
    let total = 0;
    for (let i = 0; i < order.length; i += 4) {
      const q = order.slice(i, i + 4);
      let pick: RotationPairing | null = null;
      let pickCost = Infinity;
      for (const [w, x, y, z] of SPLITS) {
        const g: RotationPairing = { a: [q[w], q[x]], b: [q[y], q[z]] };
        const gc = cost(g);
        if (gc < pickCost) [pick, pickCost] = [g, gc];
      }
      games.push(pick!);
      total += pickCost;
    }
    if (!best || total < best.cost) best = { games, cost: total };
    if (total === 0) break;
  }
  return { games: best?.games ?? [], byes };
}

/** All rounds of an Americano up front. */
export function planAmericano(players: string[], rounds: number, rand: () => number = Math.random): RotationRound[] {
  const out: RotationRound[] = [];
  for (let r = 0; r < rounds; r++) {
    out.push(planAmericanoRound(players, out.flatMap((x) => x.games), out.map((x) => x.byes), rand));
  }
  return out;
}

/** Mexicano round from a ranking (best first): byes go to who sat out least
 * (lowest-ranked first), then every group of four plays #1+#4 vs #2+#3.
 * Avoids repeating last round's exact duos by swapping to #1+#3 vs #2+#4. */
export function planMexicanoRound(ranking: string[], history: RotationPairing[], byeRounds: string[][], rand: () => number = Math.random): RotationRound {
  const c = countsFrom(history, byeRounds);
  const byes = pickByes(ranking, ranking.length % 4, c.byes, rand, [...ranking].reverse());
  const playing = ranking.filter((p) => !byes.includes(p));
  const last = new Set(history.slice(-Math.max(1, gamesPerRound(ranking.length))).flatMap((g) => [pairKey(g.a[0], g.a[1]), pairKey(g.b[0], g.b[1])]));
  const games: RotationPairing[] = [];
  for (let i = 0; i < playing.length; i += 4) {
    const [p1, p2, p3, p4] = playing.slice(i, i + 4);
    const repeat = last.has(pairKey(p1, p4)) || last.has(pairKey(p2, p3));
    games.push(repeat ? { a: [p1, p3], b: [p2, p4] } : { a: [p1, p4], b: [p2, p3] });
  }
  return { games, byes };
}

export type RotationStanding = {
  userId: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  mama: number;
  kruipen: number;
  elo: number;
  byes: number;
  /** Distinct partners played with. */
  partners: number;
};

/** Individual standings: win %, then wins, then mamas, then Elo gained in
 * the tournament (win % rather than raw wins, so a bye doesn't cost you). */
export function rotationStandings(players: string[], games: RotationGameResult[], byeRounds: string[][]): RotationStanding[] {
  const s = new Map<string, RotationStanding & { partnerSet: Set<string> }>(
    players.map((id) => [id, { userId: id, games: 0, wins: 0, losses: 0, winPct: 0, mama: 0, kruipen: 0, elo: 0, byes: 0, partners: 0, partnerSet: new Set() }]),
  );
  for (const g of games) {
    if (g.aWon === null) continue;
    for (const [team, won, kruip] of [
      [g.a, g.aWon, g.kruipA],
      [g.b, !g.aWon, g.kruipB],
    ] as const) {
      for (const id of team) {
        const x = s.get(id);
        if (!x) continue;
        x.games++;
        if (won) x.wins++;
        else x.losses++;
        if (!won && kruip) x.kruipen++;
        x.mama += g.mama?.[id] ?? 0;
        x.elo += g.elo?.[id] ?? 0;
        x.partnerSet.add(team[0] === id ? team[1] : team[0]);
      }
    }
  }
  for (const r of byeRounds) for (const id of r) { const x = s.get(id); if (x) x.byes++; }
  return [...s.values()]
    .map(({ partnerSet, ...x }) => ({ ...x, partners: partnerSet.size, winPct: x.games ? Math.round((x.wins / x.games) * 100) : 0 }))
    .sort((x, y) => {
      const px = x.games ? x.wins / x.games : 0;
      const py = y.games ? y.wins / y.games : 0;
      return py - px || y.wins - x.wins || y.mama - x.mama || y.elo - x.elo || x.losses - y.losses;
    });
}

/** Which unplayed games can be on a mat right now: in order, at most `mats`,
 * never two games sharing a player. The rest wait in the queue. */
export function onTheMats<T extends RotationPairing & { played: boolean }>(games: T[], mats: number): { now: T[]; queue: T[] } {
  const now: T[] = [];
  const busy = new Set<string>();
  const queue: T[] = [];
  for (const g of games) {
    if (g.played) continue;
    const ids = [...g.a, ...g.b];
    if (now.length < mats && !ids.some((id) => busy.has(id))) {
      now.push(g);
      ids.forEach((id) => busy.add(id));
    } else queue.push(g);
  }
  return { now, queue };
}
