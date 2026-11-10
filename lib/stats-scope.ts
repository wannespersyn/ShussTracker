/**
 * Stats scope
 *
 * Everything the stats blocks show, computed once for the chosen crew,
 * player and period from the stats page payload: Elo curve, totals, mamas,
 * kruipen, nights (sessions), streaks, partners, rivals and crew boards.
 *
 * Data: StatsExplorerData (lib/db/stats.ts) in, plain numbers out.
 */
import type { StatsEloPoint, StatsExplorerData, StatsGame } from "@/lib/db/stats";
import { ELO_BASE } from "@/lib/elo";

export const DAY = 24 * 3600 * 1000;
/** Games further apart than this belong to different sessions (nights). */
export const SESSION_GAP = 3 * 3600 * 1000;
/** A night is "on fire"/"ice cold" when its win % is this many points off the all-time win %. */
export const FORM_SWING = 15;

export type Period = "session" | "7d" | "30d" | "season" | "ever" | "custom";
type Team = StatsGame["teams"][number];
export type Mine = { g: StatsGame; team: Team };
export type Board = { id: string; v: number }[];

/** Splits games (any order) into sessions: runs with < 3h between games, newest first. */
export function sessionsOf(games: StatsGame[]): StatsGame[][] {
  const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const out: StatsGame[][] = [];
  for (const g of sorted) {
    const cur = out[out.length - 1];
    if (cur && new Date(g.playedAt).getTime() - new Date(cur[cur.length - 1].playedAt).getTime() < SESSION_GAP) cur.push(g);
    else out.push([g]);
  }
  return out.reverse();
}

const byTime = (a: Mine, b: Mine) => a.g.playedAt.localeCompare(b.g.playedAt);

export function longestStreak(m: Mine[]): number {
  let best = 0;
  let run = 0;
  for (const x of [...m].sort(byTime)) {
    run = x.team.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function mineOf(list: StatsGame[], id: string): Mine[] {
  return list.map((g) => ({ g, team: g.teams.find((x) => x.userIds.includes(id)) })).filter((x): x is Mine => !!x.team);
}

export function periodRange(period: Period, now: number, opts: { lastSessionStart?: number; from?: string; to?: string }): [number, number] {
  if (period === "ever") return [0, Infinity];
  if (period === "7d") return [now - 7 * DAY, Infinity];
  if (period === "30d") return [now - 30 * DAY, Infinity];
  if (period === "season") return [new Date(new Date(now).getFullYear(), 0, 1).getTime(), Infinity];
  if (period === "session") return [opts.lastSessionStart ?? now, Infinity];
  const a = new Date(`${opts.from}T00:00`).getTime();
  const b = new Date(`${opts.to}T00:00`).getTime() + DAY;
  return [Number.isNaN(a) ? 0 : a, Number.isNaN(b) ? Infinity : b];
}

export type StatsScope = ReturnType<typeof buildScope>;

export function buildScope(data: StatsExplorerData, crewId: string, playerId: string, range: [number, number]) {
  const inRange = (iso: string) => {
    const ms = new Date(iso).getTime();
    return ms >= range[0] && ms < range[1];
  };
  const crewGames = data.games.filter((g) => g.crewId === crewId);
  const games = crewGames.filter((g) => inRange(g.playedAt));
  const people = [...new Set(crewGames.flatMap((g) => g.teams.flatMap((x) => x.userIds)))];
  const mine = mineOf(games, playerId);
  const allMine = mineOf(crewGames, playerId);
  const wins = mine.filter((x) => x.team.won).length;
  const mamaOf = (x: Mine, id: string) => x.team.shots[id]?.risk ?? 0;
  const mamas = mine.reduce((n, x) => n + mamaOf(x, playerId), 0);
  const kruipen = mine.filter((x) => x.team.kruip).length;
  const allTimePct = allMine.length ? (allMine.filter((x) => x.team.won).length / allMine.length) * 100 : 0;

  // Elo curve in the period (plus where it started).
  const crewElo = data.elo[crewId] ?? {};
  const allPts: StatsEloPoint[] = crewElo[playerId] ?? [];
  const pts = allPts.filter((p) => inRange(p.t));
  const before = allPts.filter((p) => new Date(p.t).getTime() < range[0]).at(-1);
  const start = before?.r ?? (pts[0] ? pts[0].r - pts[0].d : ELO_BASE);
  const eloNow = pts.at(-1)?.r ?? allPts.at(-1)?.r ?? start;
  const eloByGame = new Map(allPts.map((p) => [p.g, p.d]));

  // Nights.
  const nights = sessionsOf(mine.map((x) => x.g)).map((list) => {
    const m = mineOf(list, playerId);
    const w = m.filter((x) => x.team.won).length;
    const pct = (w / m.length) * 100;
    return {
      key: list[0].id,
      at: list[0].playedAt,
      n: m.length,
      w,
      elo: m.reduce((s, x) => s + (eloByGame.get(x.g.id) ?? 0), 0),
      mama: m.reduce((s, x) => s + mamaOf(x, playerId), 0),
      form: m.length >= 3 && allMine.length >= 10 ? (pct - allTimePct >= FORM_SWING ? "hot" : allTimePct - pct >= FORM_SWING ? "cold" : null) : null,
    } as const;
  });

  // Mama extras.
  const mamaGames = mine.filter((x) => mamaOf(x, playerId) > 0).length;
  let crewMama = 0;
  let crewSlots = 0;
  for (const g of games) for (const t of g.teams) for (const u of t.userIds) {
    crewSlots++;
    crewMama += t.shots[u]?.risk ?? 0;
  }
  const best = [...mine].sort((a, b) => mamaOf(b, playerId) - mamaOf(a, playerId) || b.g.playedAt.localeCompare(a.g.playedAt))[0];
  const bestGame = best && mamaOf(best, playerId) > 0
    ? { n: mamaOf(best, playerId), at: best.g.playedAt, gameId: best.g.id, partners: best.team.userIds.filter((u) => u !== playerId) }
    : null;
  // Nights in a row (oldest → newest) with at least one mama.
  let mamaRun = 0;
  let mamaRunBest = 0;
  for (const n of [...nights].reverse()) {
    mamaRun = n.mama > 0 ? mamaRun + 1 : 0;
    mamaRunBest = Math.max(mamaRunBest, mamaRun);
  }

  // Streaks: current is all-time (latest games), best is within the period.
  let current = 0;
  for (const x of [...allMine].sort(byTime).reverse()) {
    if (x.team.won) current++;
    else break;
  }

  // Partners.
  const per = new Map<string, { w: number; n: number }>();
  for (const { team } of mine)
    for (const u of team.userIds) {
      if (u === playerId) continue;
      const e = per.get(u) ?? { w: 0, n: 0 };
      e.n++;
      if (team.won) e.w++;
      per.set(u, e);
    }
  const minPartner = [...per.values()].some((e) => e.n >= 10) ? 10 : 3;
  const partners = [...per]
    .filter(([, e]) => e.n >= minPartner)
    .map(([id, e]) => ({ id, pct: Math.round((e.w / e.n) * 100), w: e.w, l: e.n - e.w, n: e.n }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n);
  const bestPartner =
    [...per]
      .map(([id, e]) => ({ id, w: e.w, l: e.n - e.w, n: e.n, pct: Math.round((e.w / e.n) * 100) }))
      .filter((x) => x.n >= Math.min(3, minPartner))
      .sort((a, b) => b.w - a.w || b.pct - a.pct)[0] ?? null;

  // Rivals: opponents faced most, with your record against them.
  const vs = new Map<string, { w: number; n: number }>();
  for (const { g, team } of mine)
    for (const t of g.teams) {
      if (t === team) continue;
      for (const u of t.userIds) {
        const e = vs.get(u) ?? { w: 0, n: 0 };
        e.n++;
        if (team.won) e.w++;
        vs.set(u, e);
      }
    }
  const rivals = [...vs].map(([id, e]) => ({ id, w: e.w, l: e.n - e.w, n: e.n })).sort((a, b) => b.n - a.n || b.w - a.w);

  // Crew boards in the period.
  const board = (score: (m: Mine[], id: string) => number): Board =>
    people
      .map((id) => ({ id, v: score(mineOf(games, id), id) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
  const crewMamaBoard = board((m, id) => m.reduce((n, x) => n + mamaOf(x, id), 0));
  const records = {
    kruipen: board((m) => m.filter((x) => x.team.kruip).length),
    mama: crewMamaBoard,
    streak: board((m) => longestStreak(m)),
    games: board((m) => m.length),
  };
  const kruipRank = records.kruipen.findIndex((x) => x.id === playerId) + 1;

  // Crew Elo ranking now, with the change in this period.
  const ranking = Object.entries(crewElo)
    .map(([id, list]) => {
      const inP = list.filter((p) => inRange(p.t));
      return { id, elo: list.at(-1)?.r ?? ELO_BASE, change: inP.reduce((s, p) => s + p.d, 0) };
    })
    .sort((a, b) => b.elo - a.elo);

  return {
    crewGames,
    games,
    people,
    mine,
    wins,
    losses: mine.length - wins,
    winPct: mine.length ? Math.round((wins / mine.length) * 100) : 0,
    mamas,
    mamaPerGame: mine.length ? mamas / mine.length : 0,
    mamaRate: mine.length ? Math.round((mamaGames / mine.length) * 100) : 0,
    crewMamaPerGame: crewSlots ? crewMama / crewSlots : 0,
    bestGame,
    mamaStreak: mamaRunBest,
    kruipen,
    kruipRank,
    curve: { pts, start, now: eloNow, change: (pts.at(-1)?.r ?? start) - start },
    nights,
    streak: { current, best: longestStreak(mine) },
    partners,
    minPartner,
    bestPartner,
    rivals,
    records,
    crewMamaBoard,
    ranking,
  };
}
