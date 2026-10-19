/**
 * monthly-recap
 *
 * Builds the six "your month" story slides from crew insights, in the
 * viewer's language (dictionary + locale-aware month names).
 *
 * Exports: buildMonthlyRecap, RecapStory
 */
import type { CrewInsights } from "@/lib/insights";
import { firstName } from "@/lib/insights";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export type RecapStory = { kicker: string; big: string; bigSize: number; line: string; foot: string; tone: "amber" | "ink" | "panel" | "red" };


/** The six "your month" story slides from the mockup, built from the crew
 * insights. Uses the current month, or last month when the viewer hasn't
 * played yet this month. Returns null when there's nothing to recap. */
export function buildMonthlyRecap(
  insights: CrewInsights,
  userId: string,
  crewName: string,
  now: Date,
  t: Dictionary,
  locale: Locale,
): { month: string; slides: RecapStory[] } | null {
  const M = t.monthly;
  const monthFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { month: "long", timeZone: "UTC" });
  const monthNameOf = (idx: number) => monthFmt.format(new Date(Date.UTC(2026, idx, 15)));
  const me = insights.players.find((p) => p.userId === userId);
  if (!me || me.games === 0) return null;

  const ym = (d: Date) => d.toISOString().slice(0, 7);
  const prev = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15));
  let month = ym(now);
  const playedIn = (m: string) => insights.sessions.some((s) => s.night.startsWith(m) && s.lines.some((l) => l.userId === userId));
  if (!playedIn(month)) month = ym(prev(now));
  if (!playedIn(month)) return null;
  const monthIdx = Number(month.slice(5, 7)) - 1;
  const monthName = monthNameOf(monthIdx);
  const prevMonth = ym(prev(new Date(`${month}-15T12:00:00Z`)));

  const nights = insights.sessions.filter((s) => s.night.startsWith(month));
  const sum = (m: string) => {
    let games = 0, wins = 0, mama = 0;
    for (const s of insights.sessions) if (s.night.startsWith(m)) for (const l of s.lines) if (l.userId === userId) { games += l.games; wins += l.wins; mama += l.mama; }
    return { games, wins, mama };
  };
  const mine = sum(month);
  const before = sum(prevMonth);
  const pct = (w: number, g: number) => (g ? Math.round((w / g) * 100) : 0);

  // Best duo this month (most wins, then fewest losses).
  const duoAcc = new Map<string, { partner: string; wins: number; losses: number }>();
  for (const s of nights) for (const d of s.duoLines) {
    if (d.a !== userId && d.b !== userId) continue;
    const partnerName = d.names.split(" & ")[d.a === userId ? 1 : 0];
    const key = d.a === userId ? d.b : d.a;
    const e = duoAcc.get(key) ?? { partner: partnerName, wins: 0, losses: 0 };
    e.wins += d.wins;
    e.losses += d.losses;
    duoAcc.set(key, e);
  }
  const bestDuo = [...duoAcc.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses)[0];

  // Mama table this month.
  const mamaBy = new Map<string, { name: string; n: number }>();
  const gamesBy = new Map<string, { name: string; n: number }>();
  for (const s of nights) for (const l of s.lines) {
    const m = mamaBy.get(l.userId) ?? { name: l.name, n: 0 };
    m.n += l.mama;
    mamaBy.set(l.userId, m);
    const g = gamesBy.get(l.userId) ?? { name: l.name, n: 0 };
    g.n += l.games;
    gamesBy.set(l.userId, g);
  }
  const mamaRank = [...mamaBy.entries()].sort((a, b) => b[1].n - a[1].n);
  const myMamaPos = mamaRank.findIndex(([id]) => id === userId) + 1;
  const runnerUp = mamaRank.find(([id]) => id !== userId);
  const crewGames = nights.reduce((n, s) => n + s.games, 0);
  const ironMan = [...gamesBy.values()].sort((a, b) => b.n - a.n)[0];

  const ranked = insights.players.filter((p) => p.games > 0);
  const above = ranked[me.rank - 2];
  const leader = ranked[0];

  const winRate = pct(mine.wins, mine.games);
  const gap = above ? above.elo - me.elo : 0;
  const slides: RecapStory[] = [
    {
      tone: "amber",
      kicker: format(M.your, { month: monthName.toUpperCase() }),
      big: M.recap,
      bigSize: 110,
      line: format(M.hello, { name: firstName(me.name) }),
      foot: M.tapNext,
    },
    {
      tone: "ink",
      kicker: M.youPlayed,
      big: String(mine.games),
      bigSize: 170,
      line: format(M.gamesWins, { w: mine.wins }),
      foot: before.games
        ? format(M.rateVs, {
            p: winRate,
            month: monthName,
            dir: winRate >= pct(before.wins, before.games) ? M.up : M.down,
            q: pct(before.wins, before.games),
            prev: monthNameOf((monthIdx + 11) % 12),
          })
        : format(M.rate, { p: winRate, month: monthName }),
    },
    bestDuo
      ? {
          tone: "panel",
          kicker: M.bestDuo,
          big: `${bestDuo.wins}–${bestDuo.losses}`,
          bigSize: 130,
          line: `${format(M.with, { name: firstName(bestDuo.partner).toUpperCase() })}\n${bestDuo.losses === 0 ? M.unbeaten : M.together}`,
          foot: format(M.bestPairing, { crew: crewName }),
        }
      : { tone: "panel", kicker: M.bestDuo, big: "—", bigSize: 130, line: M.noDuo, foot: M.grabPartner },
    {
      tone: "red",
      kicker: M.mamaMachine,
      big: String(mine.mama),
      bigSize: 170,
      line: M.redHits,
      foot:
        mine.mama > 0
          ? `${format(M.mamaPos, { pos: myMamaPos, crew: crewName })}${runnerUp ? ` ${format(M.runnerUp, { name: firstName(runnerUp[1].name), n: runnerUp[1].n })}` : ""}`
          : M.noneSharp,
    },
    {
      tone: "ink",
      kicker: M.crewMonth,
      big: String(crewGames),
      bigSize: 150,
      line: format(M.gamesIn, { crew: crewName }),
      foot: ironMan ? format(M.iron, { name: firstName(ironMan.name), n: ironMan.n }) : "",
    },
    {
      tone: "amber",
      kicker: format(M.rank, { month: monthName.toUpperCase() }),
      big: `#${me.rank}`,
      bigSize: 170,
      line: `${format(M.inCrew, { crew: crewName })}\nELO ${me.elo}${me.eloWeek ? ` ${format(M.thisWeek, { arrow: me.eloWeek > 0 ? "▲" : "▼", n: Math.abs(me.eloWeek) })}` : ""}`,
      foot:
        me.rank === 1
          ? M.top
          : `${format(gap === 1 ? M.aheadOne : M.ahead, { name: firstName(above.name), n: gap })}${leader && leader !== above ? ` ${firstName(leader.name)} ${leader.elo - me.elo}.` : ""} ${M.yours}`,
    },
  ];
  return { month: monthName, slides };
}
