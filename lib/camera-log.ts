/**
 * Camera log (beta)
 *
 * The mat logger shares its game with the linked camera (CameraGame: the
 * lib/mat.ts state, player names, which camera throw became which mat
 * throw). These pure functions turn that game into what the camera phone
 * shows next to its throws: a step-by-step log (round start, every throw
 * with where it counts, caps shot away, own-zone throws, mama shot out,
 * skipped turns, the drinking per round, mat cleared) and stats per player
 * and per team.
 *
 * Data: CameraGame in (from camera_game via getCameraState), plain objects out.
 */

import { ZONES, drunk, knockedMamas, teamOfSlot, type MatState, type Slot } from "@/lib/mat";

export type CameraGame = {
  v: 1;
  st: MatState;
  /** Player name per slot. */
  names: Partial<Record<Slot, string>>;
  /** Camera throw number → index in st.throws it became. */
  links: Record<string, number>;
  /** Newest camera throw the logger has looked at (used or skipped). */
  seen: number;
  /** Camera throw on the logger's mat, waiting to count. */
  pending: { n: number; left: number; touched: boolean; found: boolean } | null;
};

export function asCameraGame(x: unknown): CameraGame | null {
  const g = x as CameraGame | null;
  return g && g.v === 1 && g.st && Array.isArray(g.st.throws) && Array.isArray(g.st.results) && Array.isArray(g.st.order) ? g : null;
}

const isMama = (s: string | null) => s === "ML" || s === "MR";
/** Points of a spot code ("L3" → 3), 0 for anything else. */
export const zoneValue = (code: string | null) => ZONES.find((z) => z.id === code)?.v ?? 0;

export type GameEvent =
  | { key: string; kind: "round"; round: number }
  | {
      key: string;
      kind: "throw";
      round: number;
      slot: Slot;
      bonus: boolean;
      /** First landing of the thrown cap: "L3", "MR", "miss", "off", "none", "box:a1". */
      spot: string;
      /** Team that drinks for it (zone/mama), null when it counts for nobody. */
      countsFor: number | null;
      /** Landed in a zone that counts for the thrower's own team. */
      own: boolean;
      /** Went into a mama and got shot out of it later that round. */
      mamaOut: boolean;
      /** Camera throw number, when the camera saw it. */
      cam: number | null;
    }
  | { key: string; kind: "knock"; round: number; slot: Slot; owner: Slot; from: string; to: string; countsFor: number | null }
  | { key: string; kind: "skip"; round: number; slot: Slot; reason: "cap_knocked" | "box_empty" | null }
  | { key: string; kind: "settle"; round: number; sips: number[]; mamaTeams: number[]; jokerTeam: number | null; allDrink: boolean; emptyStreak: number }
  | { key: string; kind: "clear"; round: number };

/** The game as a list of events, oldest first. */
export function gameEvents(g: CameraGame): GameEvent[] {
  const { st } = g;
  const camOf = new Map(Object.entries(g.links).map(([n, i]) => [i, Number(n)]));
  const out = knockedMamas(st.throws);
  const ev: GameEvent[] = [];
  for (let r = 1; r <= st.round; r++) {
    ev.push({ key: `r${r}`, kind: "round", round: r });
    st.throws.forEach((t, i) => {
      if (t.round !== r) return;
      if (t.kind === "skipped") {
        ev.push({ key: `t${i}`, kind: "skip", round: r, slot: t.slot, reason: t.skipReason });
        return;
      }
      const mine = t.moves.find((m) => m.isThrownCap);
      const countsFor = t.missed ? null : (mine?.to.countsFor ?? null);
      ev.push({
        key: `t${i}`,
        kind: "throw",
        round: r,
        slot: t.slot,
        bonus: t.kind === "bonus",
        spot: t.firstSpot ?? "none",
        countsFor,
        own: countsFor !== null && countsFor === teamOfSlot(t.slot) && !isMama(t.firstSpot),
        mamaOut: out.has(i),
        cam: camOf.get(i) ?? null,
      });
      t.moves.forEach((m, j) => {
        if (m.isThrownCap) return;
        ev.push({ key: `t${i}m${j}`, kind: "knock", round: r, slot: t.slot, owner: m.owner, from: m.from.spot, to: m.to.spot, countsFor: m.to.countsFor });
      });
    });
    const res = st.results.find((x) => x.round === r);
    if (res) {
      // The joker can still be played after the round: part of the key, so the line refreshes.
      ev.push({ ...res, key: `s${r}j${res.jokerTeam ?? "-"}`, kind: "settle" });
      if (r < st.round) ev.push({ key: `c${r}`, kind: "clear", round: r });
    }
  }
  return ev;
}

export type PlayerStats = {
  slot: Slot;
  name: string;
  team: number;
  throws: number;
  misses: number;
  /** First landings per zone value (1, 2, 3). */
  hits: [number, number, number];
  mamas: number;
  mamasOut: number;
  /** Points thrown that the other team drinks / that your own team drinks. */
  forOpp: number;
  ownPoints: number;
  ownThrows: number;
  /** Other caps this player shot away, and own caps shot away by others. */
  knocks: number;
  knockedBy: number;
  skipped: number;
};

export type TeamStats = { team: number; sips: number; adFundum: number; jokers: number };

export function gameStats(g: CameraGame): { players: PlayerStats[]; teams: TeamStats[]; rounds: number; throws: number } {
  const { st } = g;
  const out = knockedMamas(st.throws);
  const players = new Map<Slot, PlayerStats>(
    st.order.map((s) => [
      s,
      { slot: s, name: g.names[s] ?? s.toUpperCase(), team: teamOfSlot(s), throws: 0, misses: 0, hits: [0, 0, 0], mamas: 0, mamasOut: 0, forOpp: 0, ownPoints: 0, ownThrows: 0, knocks: 0, knockedBy: 0, skipped: 0 },
    ]),
  );
  let throws = 0;
  st.throws.forEach((t, i) => {
    const p = players.get(t.slot);
    if (!p) return;
    if (t.kind === "skipped") {
      p.skipped++;
      return;
    }
    throws++;
    p.throws++;
    const spot = t.firstSpot;
    const v = zoneValue(spot);
    const mine = t.moves.find((m) => m.isThrownCap);
    const countsFor = t.missed ? null : (mine?.to.countsFor ?? null);
    if (t.missed || spot === "miss" || spot === "off") p.misses++;
    if (v) {
      p.hits[v - 1]++;
      if (countsFor === p.team) {
        p.ownPoints += v;
        p.ownThrows++;
      } else p.forOpp += v;
    }
    if (isMama(spot)) {
      if (out.has(i)) p.mamasOut++;
      else p.mamas++;
    }
    for (const m of t.moves) {
      if (m.isThrownCap) continue;
      p.knocks++;
      const victim = players.get(m.owner);
      if (victim) victim.knockedBy++;
    }
  });
  const teams: TeamStats[] = [0, 1].map((ti) => ({ team: ti, sips: 0, adFundum: 0, jokers: st.jokersUsed.includes(ti) ? 1 : 0 }));
  for (const raw of st.results) {
    const r = drunk(raw);
    r.sips.forEach((n, ti) => (teams[ti].sips += n));
    for (const ti of r.mamaTeams) teams[ti].adFundum++;
    if (r.allDrink) teams.forEach((tm) => tm.adFundum++);
  }
  return { players: [...players.values()], teams, rounds: st.results.length, throws };
}

/** Give every game line not seen before the current time (the log's order);
 * mutates `seen`, returns whether anything was added. Call it when a poll
 * comes in, not while rendering. */
export function stampEvents(g: CameraGame, seen: Record<string, number>): boolean {
  const now = Date.now();
  let added = false;
  gameEvents(g).forEach((e, i) => {
    if (seen[e.key] !== undefined) return;
    seen[e.key] = now + i / 1000;
    added = true;
  });
  return added;
}
