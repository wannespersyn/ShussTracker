import type { CrewInsights } from "@/lib/insights";
import { firstName } from "@/lib/insights";

export type RecapStory = { kicker: string; big: string; bigSize: number; line: string; foot: string; tone: "amber" | "ink" | "panel" | "red" };

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The six "your month" story slides from the mockup, built from the crew
 * insights. Uses the current month, or last month when the viewer hasn't
 * played yet this month. Returns null when there's nothing to recap. */
export function buildMonthlyRecap(insights: CrewInsights, userId: string, crewName: string, now: Date): { month: string; slides: RecapStory[] } | null {
  const me = insights.players.find((p) => p.userId === userId);
  if (!me || me.games === 0) return null;

  const ym = (d: Date) => d.toISOString().slice(0, 7);
  const prev = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15));
  let month = ym(now);
  const playedIn = (m: string) => insights.sessions.some((s) => s.night.startsWith(m) && s.lines.some((l) => l.userId === userId));
  if (!playedIn(month)) month = ym(prev(now));
  if (!playedIn(month)) return null;
  const monthIdx = Number(month.slice(5, 7)) - 1;
  const monthName = MONTHS_EN[monthIdx];
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

  const slides: RecapStory[] = [
    { tone: "amber", kicker: `YOUR ${monthName.toUpperCase()}`, big: "RECAP", bigSize: 110, line: `${firstName(me.name)}, it’s\nbeen a month.`, foot: "Tap next. Then share it to your story." },
    {
      tone: "ink",
      kicker: "YOU PLAYED",
      big: String(mine.games),
      bigSize: 170,
      line: `games · ${mine.wins} wins`,
      foot: before.games
        ? `${pct(mine.wins, mine.games)}% win rate in ${monthName} — ${pct(mine.wins, mine.games) >= pct(before.wins, before.games) ? "up" : "down"} from ${pct(before.wins, before.games)}% in ${MONTHS_EN[(monthIdx + 11) % 12]}.`
        : `${pct(mine.wins, mine.games)}% win rate in ${monthName}.`,
    },
    bestDuo
      ? {
          tone: "panel",
          kicker: "BEST DUO",
          big: `${bestDuo.wins}–${bestDuo.losses}`,
          bigSize: 130,
          line: `WITH ${firstName(bestDuo.partner).toUpperCase()}\n${bestDuo.losses === 0 ? "unbeaten" : "together"}`,
          foot: `Your best pairing in ${crewName} this month.`,
        }
      : { tone: "panel", kicker: "BEST DUO", big: "—", bigSize: 130, line: "No duo games\nthis month", foot: "Grab a partner next time." },
    {
      tone: "red",
      kicker: "MAMA MACHINE",
      big: String(mine.mama),
      bigSize: 170,
      line: "red-field hits",
      foot:
        mine.mama > 0
          ? `#${myMamaPos} in ${crewName} this month.${runnerUp ? ` ${firstName(runnerUp[1].name)} had ${runnerUp[1].n}.` : ""}`
          : "Not a single one. Sharp.",
    },
    {
      tone: "ink",
      kicker: "CREW MONTH",
      big: String(crewGames),
      bigSize: 150,
      line: `games played\nin ${crewName}`,
      foot: ironMan ? `${firstName(ironMan.name)} played ${ironMan.n} of them. Respect.` : "",
    },
    {
      tone: "amber",
      kicker: `${monthName.toUpperCase()} RANK`,
      big: `#${me.rank}`,
      bigSize: 170,
      line: `in ${crewName}\nELO ${me.elo}${me.eloWeek ? ` (${me.eloWeek > 0 ? "▲" : "▼"}${Math.abs(me.eloWeek)} this week)` : ""}`,
      foot:
        me.rank === 1
          ? "Top of the crew. Defend it."
          : `${firstName(above.name)} is ${above.elo - me.elo} point${above.elo - me.elo === 1 ? "" : "s"} ahead.${leader && leader !== above ? ` ${firstName(leader.name)} ${leader.elo - me.elo}.` : ""} Next month is yours.`,
    },
  ];
  return { month: monthName, slides };
}
