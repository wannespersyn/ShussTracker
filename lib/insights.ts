import { ELO_BASE, ELO_K } from "@/lib/elo";

/* -----------------------------------------------------------------------
 * Crew insights — everything the v2 scoreboard screens show (rank moves,
 * form, streaks, duo records, per-night sessions) computed in one pass
 * over a crew's game history. Pure functions: the DB loader lives in
 * lib/db/crew-insights.ts. Crew histories are small (hundreds of games),
 * so replaying them in memory per request is cheap and keeps every number
 * consistent with every other one.
 * --------------------------------------------------------------------- */

export type InsightPlayerRef = { id: string; name: string; isGuest: boolean };
export type InsightTeam = { rank: number | null; players: (InsightPlayerRef & { mama: number; shots: number })[] };
export type InsightGame = { id: string; playedAt: Date; matType: "2" | "4" | "8"; teams: InsightTeam[] };

export type Streak = { kind: "W" | "L"; n: number };

export type PlayerInsight = {
  userId: string;
  name: string;
  isGuest: boolean;
  elo: number;
  rank: number;
  /** Positive = climbed this many places over the last 7 days. */
  move: number;
  eloWeek: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  mama: number;
  /** Last 10 results, oldest first. */
  form: ("W" | "L")[];
  streak: Streak | null;
  bestWinStreak: number;
  /** Elo after each night played (for sparklines), oldest first. */
  eloHistory: { date: string; elo: number }[];
};

export type DuoInsight = {
  key: string;
  a: InsightPlayerRef;
  b: InsightPlayerRef;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  /** Mean of both players' current Elo. */
  duoElo: number;
  mamaA: number;
  mamaB: number;
  bestWinStreak: number;
  streak: Streak | null;
  recent: { gameId: string; playedAt: Date; won: boolean; opponents: string; mama: number; streakAfter: number }[];
};

export type SessionInsight = {
  /** YYYY-MM-DD of the night (games before 06:00 count for the evening before). */
  night: string;
  games: number;
  players: number;
  mvp: { userId: string; name: string; wins: number; eloDelta: number } | null;
  movers: { userId: string; name: string; delta: number }[];
  mamaKings: { names: string[]; count: number } | null;
  ironLiver: { name: string; games: number } | null;
  duoOfNight: { names: string; wins: number; losses: number } | null;
  /** Per player: wins / games / mama tonight. */
  lines: { userId: string; name: string; games: number; wins: number; mama: number }[];
};

export type CrewInsights = {
  players: PlayerInsight[];
  duos: DuoInsight[];
  sessions: SessionInsight[];
  totalGames: number;
  firstGameAt: Date | null;
  /** Elo change per game per player: gameElo[gameId][userId]. */
  gameElo: Record<string, Record<string, number>>;
};

const TZ = "Europe/Brussels";
const nightFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Bucket a timestamp into its "night": a 23:40 game and a 01:10 game are
 * the same session, so shift 6 hours back before taking the local date. */
export function nightKey(at: Date): string {
  return nightFmt.format(new Date(at.getTime() - 6 * 3600 * 1000));
}

const duoKey = (a: string, b: string) => [a, b].sort().join("+");

function expected(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

function streakOf(results: ("W" | "L")[]): Streak | null {
  if (results.length === 0) return null;
  const last = results[results.length - 1];
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return { kind: last, n };
}

function bestRun(results: ("W" | "L")[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r === "W" ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

export function buildCrewInsights(
  members: InsightPlayerRef[],
  rawGames: InsightGame[],
  now: Date = new Date(),
): CrewInsights {
  const games = [...rawGames].sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime());
  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;

  const people = new Map<string, InsightPlayerRef>(members.map((m) => [m.id, m]));
  const rating = new Map<string, number>();
  const ratingWeekAgo = new Map<string, number>();
  const results = new Map<string, ("W" | "L")[]>();
  const mama = new Map<string, number>();
  const history = new Map<string, Map<string, number>>();
  const ratingOf = (id: string) => rating.get(id) ?? ELO_BASE;

  type DuoAcc = { a: string; b: string; results: ("W" | "L")[]; mama: Record<string, number>; recent: DuoInsight["recent"] };
  const duos = new Map<string, DuoAcc>();

  type NightAcc = {
    games: number;
    eloStart: Map<string, number>;
    lines: Map<string, { games: number; wins: number; mama: number }>;
    duos: Map<string, { names: string; wins: number; losses: number }>;
  };
  const nights = new Map<string, NightAcc>();
  const gameElo: Record<string, Record<string, number>> = {};

  for (const game of games) {
    const teams = game.teams.filter((t) => t.rank != null && t.players.length > 0);
    for (const t of game.teams) for (const p of t.players) if (!people.has(p.id)) people.set(p.id, p);
    if (teams.length < 2) continue;

    const night = nightKey(game.playedAt);
    const acc =
      nights.get(night) ??
      { games: 0, eloStart: new Map(), lines: new Map(), duos: new Map() };
    nights.set(night, acc);
    acc.games++;

    // Elo — same math as lib/elo.ts (team average, round-robin pairs).
    const teamRating = (t: InsightTeam) => t.players.reduce((s, p) => s + ratingOf(p.id), 0) / t.players.length;
    const deltas = new Map<string, number>();
    const pairs = teams.length - 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const A = teams[i];
        const B = teams[j];
        const actual = A.rank === B.rank ? 0.5 : A.rank! < B.rank! ? 1 : 0;
        const change = (ELO_K * (actual - expected(teamRating(A), teamRating(B)))) / pairs;
        for (const p of A.players) deltas.set(p.id, (deltas.get(p.id) ?? 0) + change);
        for (const p of B.players) deltas.set(p.id, (deltas.get(p.id) ?? 0) - change);
      }
    }

    const best = Math.min(...teams.map((t) => t.rank!));
    for (const team of teams) {
      const won = team.rank === best;
      for (const p of team.players) {
        if (!acc.eloStart.has(p.id)) acc.eloStart.set(p.id, ratingOf(p.id));
        const list = results.get(p.id) ?? [];
        list.push(won ? "W" : "L");
        results.set(p.id, list);
        mama.set(p.id, (mama.get(p.id) ?? 0) + p.mama);
        const line = acc.lines.get(p.id) ?? { games: 0, wins: 0, mama: 0 };
        line.games++;
        if (won) line.wins++;
        line.mama += p.mama;
        acc.lines.set(p.id, line);
      }
      if (team.players.length === 2) {
        const [p1, p2] = team.players;
        const key = duoKey(p1.id, p2.id);
        const d = duos.get(key) ?? { a: p1.id, b: p2.id, results: [], mama: {}, recent: [] };
        d.results.push(won ? "W" : "L");
        d.mama[p1.id] = (d.mama[p1.id] ?? 0) + p1.mama;
        d.mama[p2.id] = (d.mama[p2.id] ?? 0) + p2.mama;
        const run = streakOf(d.results);
        d.recent.push({
          gameId: game.id,
          playedAt: game.playedAt,
          won,
          opponents: teams
            .filter((t) => t !== team)
            .map((t) => t.players.map((p) => firstName(p.name)).join(" & "))
            .join(", "),
          mama: p1.mama + p2.mama,
          streakAfter: run && run.kind === "W" ? run.n : 0,
        });
        duos.set(key, d);
        const names = `${firstName(p1.name)} & ${firstName(p2.name)}`;
        const nd = acc.duos.get(key) ?? { names, wins: 0, losses: 0 };
        if (won) nd.wins++;
        else nd.losses++;
        acc.duos.set(key, nd);
      }
    }

    gameElo[game.id] = Object.fromEntries([...deltas].map(([id, d]) => [id, Math.round(d)]));
    for (const [id, delta] of deltas) {
      if (game.playedAt.getTime() <= weekAgo) ratingWeekAgo.set(id, ratingOf(id) + delta);
      rating.set(id, ratingOf(id) + delta);
      const h = history.get(id) ?? new Map<string, number>();
      h.set(night, rating.get(id)!);
      history.set(id, h);
    }
  }

  // Players: crew members (even with zero games) plus anyone who played.
  const ids = new Set<string>([...members.map((m) => m.id), ...results.keys()]);
  const base = [...ids].map((id) => {
    const res = results.get(id) ?? [];
    const wins = res.filter((r) => r === "W").length;
    const ref = people.get(id)!;
    return {
      userId: id,
      name: ref.name,
      isGuest: ref.isGuest,
      elo: Math.round(ratingOf(id)),
      eloThen: ratingWeekAgo.get(id) ?? ELO_BASE,
      games: res.length,
      wins,
      losses: res.length - wins,
      winPct: res.length ? Math.round((wins / res.length) * 100) : 0,
      mama: mama.get(id) ?? 0,
      form: res.slice(-10),
      streak: streakOf(res),
      bestWinStreak: bestRun(res),
      eloHistory: [...(history.get(id) ?? new Map()).entries()].map(([date, elo]) => ({ date, elo: Math.round(elo) })),
    };
  });

  const byNow = [...base].sort((x, y) => y.elo - x.elo || y.games - x.games);
  const byThen = [...base].sort((x, y) => y.eloThen - x.eloThen || y.games - x.games);
  const thenRank = new Map(byThen.map((p, i) => [p.userId, i + 1]));
  const players: PlayerInsight[] = byNow.map((p, i) => ({
    userId: p.userId,
    name: p.name,
    isGuest: p.isGuest,
    elo: p.elo,
    rank: i + 1,
    move: p.games === 0 ? 0 : (thenRank.get(p.userId) ?? i + 1) - (i + 1),
    eloWeek: Math.round(p.elo - p.eloThen),
    games: p.games,
    wins: p.wins,
    losses: p.losses,
    winPct: p.winPct,
    mama: p.mama,
    form: p.form,
    streak: p.streak,
    bestWinStreak: p.bestWinStreak,
    eloHistory: p.eloHistory,
  }));

  const duoList: DuoInsight[] = [...duos.entries()].map(([key, d]) => {
    const wins = d.results.filter((r) => r === "W").length;
    return {
      key,
      a: people.get(d.a)!,
      b: people.get(d.b)!,
      games: d.results.length,
      wins,
      losses: d.results.length - wins,
      winPct: Math.round((wins / d.results.length) * 100),
      duoElo: Math.round((ratingOf(d.a) + ratingOf(d.b)) / 2),
      mamaA: d.mama[d.a] ?? 0,
      mamaB: d.mama[d.b] ?? 0,
      bestWinStreak: bestRun(d.results),
      streak: streakOf(d.results),
      recent: d.recent.slice(-5).reverse(),
    };
  });

  const sessions: SessionInsight[] = [...nights.entries()]
    .map(([night, acc]) => {
      const lines = [...acc.lines.entries()].map(([userId, l]) => ({ userId, name: people.get(userId)?.name ?? "Player", ...l }));
      const endElo = (id: string) => {
        const h = history.get(id);
        return h?.get(night) ?? ratingOf(id);
      };
      const movers = lines
        .map((l) => ({ userId: l.userId, name: l.name, delta: Math.round(endElo(l.userId) - (acc.eloStart.get(l.userId) ?? ELO_BASE)) }))
        .sort((x, y) => y.delta - x.delta);
      const top = [...lines].sort((x, y) => y.wins - x.wins || y.wins / y.games - x.wins / x.games)[0];
      const maxMama = Math.max(0, ...lines.map((l) => l.mama));
      const iron = [...lines].sort((x, y) => y.games - x.games)[0];
      const duo = [...acc.duos.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses)[0];
      return {
        night,
        games: acc.games,
        players: lines.length,
        mvp: top
          ? { userId: top.userId, name: top.name, wins: top.wins, eloDelta: movers.find((m) => m.userId === top.userId)?.delta ?? 0 }
          : null,
        movers,
        mamaKings: maxMama > 0 ? { names: lines.filter((l) => l.mama === maxMama).map((l) => firstName(l.name)), count: maxMama } : null,
        ironLiver: iron ? { name: iron.name, games: iron.games } : null,
        duoOfNight: duo && duo.wins > 0 ? duo : null,
        lines: lines.sort((x, y) => y.wins - x.wins || y.games - x.games),
      };
    })
    .sort((x, y) => (x.night < y.night ? 1 : -1));

  return {
    players,
    duos: duoList,
    sessions,
    totalGames: games.length,
    firstGameAt: games[0]?.playedAt ?? null,
    gameElo,
  };
}

/** "faye Dhoye" -> "Faye"; keeps short-word nicknames like "De 12de man" whole. */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1 || parts[0].length <= 3) return name.trim();
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}
