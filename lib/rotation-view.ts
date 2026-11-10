/**
 * Rotation view model
 *
 * Turns a loaded rotation (lib/db/rotations getRotation) into what the
 * Americano screens show: progress, the games on each mat (with duo Elo and
 * "first time together"), who sits out, the queue, each player's form, and
 * the end-of-night awards.
 *
 * Data: pure functions over RotationView — no DB access.
 */
import type { RotationGameView, RotationView } from "@/lib/db/rotations";
import { gamesPerRound, onTheMats } from "@/lib/rotation";

const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

export type MatSlot = RotationGameView & { aElo: number; bElo: number; firstTimeA: boolean; firstTimeB: boolean };

export function rotationProgress(v: RotationView) {
  const played = v.games.filter((g) => g.played).length;
  const perRound = gamesPerRound(v.players.length);
  const total = v.status === "completed" ? played : Math.max(v.games.length, perRound * v.rounds);
  const open = v.games.filter((g) => !g.played);
  const current = open.length ? Math.min(...open.map((g) => g.round)) : v.plannedRounds;
  // Share of the current round already played, for the partial progress segment.
  const inRound = v.games.filter((g) => g.round === current);
  const roundShare = inRound.length ? inRound.filter((g) => g.played).length / inRound.length : 1;
  return { played, total, current, roundShare, rounds: v.rounds };
}

export function matsNow(v: RotationView): { now: MatSlot[]; queue: RotationGameView[] } {
  const { now, queue } = onTheMats(v.games, v.mats);
  const avg = (ids: readonly string[]) => Math.round(ids.reduce((s, id) => s + (v.crewElo[id] ?? 1000), 0) / ids.length);
  const playedBefore = (g: RotationGameView) => {
    const seen = new Set<string>();
    for (const x of v.games) if (x.played && x.round < g.round) for (const t of [x.a, x.b]) seen.add(pairKey(t[0], t[1]));
    return seen;
  };
  return {
    now: now.map((g) => {
      const seen = playedBefore(g);
      return { ...g, aElo: avg(g.a), bElo: avg(g.b), firstTimeA: !seen.has(pairKey(g.a[0], g.a[1])), firstTimeB: !seen.has(pairKey(g.b[0], g.b[1])) };
    }),
    queue,
  };
}

/** Last results per player in this rotation, oldest first. */
export function formOf(v: RotationView): Record<string, ("W" | "L")[]> {
  const out: Record<string, ("W" | "L")[]> = {};
  for (const g of [...v.games].filter((x) => x.played).sort((a, b) => a.round - b.round || a.idx - b.idx)) {
    for (const id of g.a) (out[id] ??= []).push(g.aWon ? "W" : "L");
    for (const id of g.b) (out[id] ??= []).push(g.aWon ? "L" : "W");
  }
  return out;
}

export type RotationAward = { kind: "mama" | "kruip" | "riser" | "mamaGame"; userId: string; value: number; round?: number };

/** End-of-night awards; each only when someone actually earned it. */
export function rotationAwards(v: RotationView): RotationAward[] {
  const out: RotationAward[] = [];
  const top = <T,>(xs: T[], score: (x: T) => number) => xs.reduce<T | null>((best, x) => (score(x) > (best ? score(best) : 0) ? x : best), null);
  const mama = top(v.standings, (s) => s.mama);
  if (mama) out.push({ kind: "mama", userId: mama.userId, value: mama.mama });
  const kruip = top(v.standings, (s) => s.kruipen);
  if (kruip) out.push({ kind: "kruip", userId: kruip.userId, value: kruip.kruipen });
  const riser = top(v.standings, (s) => s.elo);
  if (riser) out.push({ kind: "riser", userId: riser.userId, value: riser.elo });
  let best: RotationAward | null = null;
  for (const g of v.games) for (const [id, n] of Object.entries(g.mama ?? {})) if (n > (best?.value ?? 0)) best = { kind: "mamaGame", userId: id, value: n, round: g.round };
  if (best && best.value >= 2) out.push(best);
  return out;
}
