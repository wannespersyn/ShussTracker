/**
 * Shussapp Wrapped (beta) — pure season maths. Takes one crew's season
 * slice (same shape as crew insights) and returns everything the 7 slides
 * show for one player: games, golden duo, "shuss hour" heat map, record
 * night, play style, Elo peak, top partners and nights. Photos are added
 * by the DB loader (lib/db/wrapped.ts).
 */
import { buildCrewInsights, firstName, nightKey, type InsightGame, type InsightPlayerRef } from "@/lib/insights";

export const WRAPPED_MIN_GAMES = 10;

export const WRAPPED_TYPES = ["mama", "muur", "laatbloeier", "kamikaze", "kameleon", "trouw", "marathon"] as const;
export type WrappedType = (typeof WRAPPED_TYPES)[number];

export type Season = { half: "autumn" | "spring"; year: number; start: Date; end: Date };

/** Academic halves: autumn = 1 Sep – 31 Jan, spring = 1 Feb – 31 Aug. */
export function seasonFor(now: Date): Season {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m >= 8) return { half: "autumn", year: y, start: new Date(Date.UTC(y, 8, 1)), end: new Date(Date.UTC(y + 1, 1, 1)) };
  if (m === 0) return { half: "autumn", year: y - 1, start: new Date(Date.UTC(y - 1, 8, 1)), end: new Date(Date.UTC(y, 1, 1)) };
  return { half: "spring", year: y, start: new Date(Date.UTC(y, 1, 1)), end: new Date(Date.UTC(y, 8, 1)) };
}

export const HEAT_HOURS = [20, 21, 22, 23, 0, 1] as const;

const TZ = "Europe/Brussels";
const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Brussels weekday (0 = Monday) and minutes since midnight. Games after
 * midnight count for the evening before, like crew "nights". */
function localSlot(at: Date) {
  const p = partsFmt.formatToParts(at);
  let wd = WD.indexOf(p.find((x) => x.type === "weekday")?.value ?? "Mon");
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const min = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  if (h < 6) wd = (wd + 6) % 7;
  return { wd, h, min };
}

type MemberStats = {
  id: string;
  games: number;
  wins: number;
  mama: number;
  eloAbs: number;
  late: { g: number; w: number };
  early: { g: number; w: number };
  partners: Map<string, { name: string; games: number; wins: number }>;
  nights: Set<string>;
  results: boolean[];
  times: { wd: number; h: number; min: number }[];
};

export type WrappedStats = {
  season: { half: Season["half"]; year: number };
  crewName: string;
  name: string;
  crewGames: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  share: number;
  duo: { partner: string; wins: number; losses: number; winRate: number; bestStreak: number } | null;
  hour: { weekday: number; time: string; heat: number[][]; recordNight: number };
  type: { key: WrappedType; a: string; b: string };
  eloPeak: number;
  mamas: number;
  rank: number;
  topPartners: string[];
  topNights: { night: string; wins: number; losses: number }[];
};

export function computeWrapped(
  userId: string,
  members: InsightPlayerRef[],
  seasonGames: InsightGame[],
  meta: { crewName: string; season: Season; now: Date },
): WrappedStats | null {
  const games = [...seasonGames].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const insights = buildCrewInsights(members, games, meta.now);
  const stats = new Map<string, MemberStats>();
  const statFor = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = { id, games: 0, wins: 0, mama: 0, eloAbs: 0, late: { g: 0, w: 0 }, early: { g: 0, w: 0 }, partners: new Map(), nights: new Set(), results: [], times: [] };
      stats.set(id, s);
    }
    return s;
  };

  for (const g of games) {
    const teams = g.teams.filter((t) => t.rank != null && t.players.length > 0);
    if (teams.length < 2) continue;
    const best = Math.min(...teams.map((t) => t.rank!));
    const slot = localSlot(g.playedAt);
    const isLate = slot.h >= 23 || slot.h < 6;
    for (const team of teams) {
      const won = team.rank === best;
      for (const p of team.players) {
        const s = statFor(p.id);
        s.games++;
        if (won) s.wins++;
        s.mama += p.mama;
        s.eloAbs += Math.abs(insights.gameElo[g.id]?.[p.id] ?? 0);
        const bucket = isLate ? s.late : s.early;
        bucket.g++;
        if (won) bucket.w++;
        s.nights.add(nightKey(g.playedAt));
        s.results.push(won);
        s.times.push(slot);
        for (const mate of team.players) {
          if (mate.id === p.id) continue;
          const pr = s.partners.get(mate.id) ?? { name: mate.name, games: 0, wins: 0 };
          pr.games++;
          if (won) pr.wins++;
          s.partners.set(mate.id, pr);
        }
      }
    }
  }

  const me = stats.get(userId);
  const meInsight = insights.players.find((p) => p.userId === userId);
  if (!me || !meInsight) return null;

  // Play style: the category where you rank highest among crew regulars.
  const minGames = Math.min(8, Math.max(3, Math.floor(me.games / 2)));
  const eligible = [...stats.values()].filter((s) => s.games >= minGames);
  const metric = (s: MemberStats, k: WrappedType): number | null => {
    switch (k) {
      case "mama":
        return s.mama / s.games;
      case "muur":
        return s.wins / s.games;
      case "kamikaze":
        return s.eloAbs / s.games;
      case "laatbloeier":
        return s.late.g >= 3 && s.early.g >= 3 ? s.late.w / s.late.g - s.early.w / s.early.g : null;
      case "kameleon":
        return [...s.partners.values()].filter((p) => p.wins * 2 > p.games).length;
      case "trouw": {
        const top = Math.max(0, ...[...s.partners.values()].map((p) => p.games));
        return s.games ? (top / s.games >= 0.6 ? top / s.games : null) : null;
      }
      case "marathon":
        return s.games;
    }
  };
  let bestType: WrappedType = "marathon";
  let bestRank = Infinity;
  for (const k of WRAPPED_TYPES) {
    const mine = metric(me, k);
    if (mine === null) continue;
    const rank = 1 + eligible.filter((s) => s.id !== userId && (metric(s, k) ?? -Infinity) > mine).length;
    if (rank < bestRank) {
      bestRank = rank;
      bestType = k;
    }
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const partnersSorted = [...me.partners.entries()].sort((a, b) => b[1].games - a[1].games);
  const topPartner = partnersSorted[0]?.[1];
  let longestLoss = 0;
  let run = 0;
  for (const r of me.results) {
    run = r ? 0 : run + 1;
    longestLoss = Math.max(longestLoss, run);
  }
  const typeStats: Record<WrappedType, [string, string]> = {
    mama: [String(me.mama), (me.mama / me.games).toFixed(2).replace(".", ",")],
    muur: [pct(me.wins / me.games), String(longestLoss)],
    kamikaze: [`±${Math.round(me.eloAbs / me.games)}`, `+${Math.round(Math.max(0, ...games.map((g) => insights.gameElo[g.id]?.[userId] ?? 0)))}`],
    laatbloeier: [me.early.g ? pct(me.early.w / me.early.g) : "—", me.late.g ? pct(me.late.w / me.late.g) : "—"],
    kameleon: [String(me.partners.size), `${[...me.partners.values()].filter((p) => p.wins * 2 > p.games).length}/${me.partners.size}`],
    trouw: [topPartner ? pct(topPartner.games / me.games) : "—", topPartner ? `${topPartner.wins}–${topPartner.games - topPartner.wins}` : "—"],
    marathon: [`${me.nights.size}/${new Set(games.map((g) => nightKey(g.playedAt))).size}`, String(me.games)],
  };

  // Golden duo: best record with 3+ games together.
  const duoPick = partnersSorted
    .filter(([, p]) => p.games >= 3)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games || b[1].wins - a[1].wins)[0];
  const duoInsight = duoPick ? insights.duos.find((d) => (d.a.id === userId && d.b.id === duoPick[0]) || (d.b.id === userId && d.a.id === duoPick[0])) : undefined;

  // Shuss hour.
  const heat = Array.from({ length: 7 }, () => HEAT_HOURS.map(() => 0));
  const perDay = Array(7).fill(0) as number[];
  for (const t of me.times) {
    perDay[t.wd]++;
    const col = HEAT_HOURS.indexOf(t.h as (typeof HEAT_HOURS)[number]);
    if (col >= 0) heat[t.wd][col]++;
  }
  const weekday = perDay.indexOf(Math.max(...perDay));
  const onDay = me.times.filter((t) => t.wd === weekday);
  const avgMin = onDay.length ? onDay.reduce((n, t) => n + ((t.h < 12 ? t.h + 24 : t.h) * 60 + t.min), 0) / onDay.length : 23 * 60;
  const hh = Math.floor(avgMin / 60) % 24;
  const mm = Math.round(avgMin % 60) % 60;
  const sessionsMine = insights.sessions
    .map((s) => ({ night: s.night, line: s.lines.find((l) => l.userId === userId) }))
    .filter((x): x is { night: string; line: NonNullable<typeof x.line> } => Boolean(x.line));
  const recordNight = Math.max(0, ...sessionsMine.map((s) => s.line.games));
  const topNights = [...sessionsMine]
    .sort((a, b) => b.line.wins - a.line.wins || a.line.games - b.line.games)
    .slice(0, 4)
    .map((s) => ({ night: s.night, wins: s.line.wins, losses: s.line.games - s.line.wins }));

  const seasonStart = meta.season.start.toISOString().slice(0, 10);
  const eloPeak = Math.max(meInsight.elo, ...meInsight.eloHistory.filter((e) => e.date >= seasonStart).map((e) => e.elo));

  return {
    season: { half: meta.season.half, year: meta.season.year },
    crewName: meta.crewName,
    name: firstName(meInsight.name),
    crewGames: games.length,
    games: me.games,
    wins: me.wins,
    losses: me.games - me.wins,
    winRate: Math.round((me.wins / me.games) * 100),
    share: games.length ? Math.round((me.games / games.length) * 100) : 0,
    duo: duoPick
      ? {
          partner: firstName(duoPick[1].name),
          wins: duoPick[1].wins,
          losses: duoPick[1].games - duoPick[1].wins,
          winRate: Math.round((duoPick[1].wins / duoPick[1].games) * 100),
          bestStreak: duoInsight?.bestWinStreak ?? 0,
        }
      : null,
    hour: { weekday, time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, heat, recordNight },
    type: { key: bestType, a: typeStats[bestType][0], b: typeStats[bestType][1] },
    eloPeak: Math.round(eloPeak),
    mamas: me.mama,
    rank: meInsight.rank,
    topPartners: partnersSorted.slice(0, 4).map(([, p]) => firstName(p.name)),
    topNights,
  };
}
