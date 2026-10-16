import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { wilsonLowerBound } from "@/lib/ranking";
import { cn } from "@/lib/cn";
import { Avatar, Kicker, Panel, Screen, StatGrid } from "@/components/v2";

export default async function DuosPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ with?: string; crew?: string }> }>) {
  const session = await requireSession();
  const userId = session.user.id;
  const [{ with: partnerId, crew: crewParam }, crews, t, locale] = await Promise.all([
    searchParams,
    getUserCrews(userId),
    getT(),
    getLocale(),
  ]);
  const crew = crews.find((c) => c.id === crewParam) ?? crews[0];
  const insights = crew ? await getCrewInsights(crew.id) : null;

  const mine = (insights?.duos ?? [])
    .filter((d) => d.a.id === userId || d.b.id === userId)
    .sort((a, b) => b.games - a.games);

  const header = (
    <header className="flex items-end justify-between h-11">
      <h1 className="font-display font-extrabold text-[34px] uppercase">{t.duo.title}</h1>
      {crew && <span className="font-body text-[13px] text-cream/55 pb-1">{crew.name}</span>}
    </header>
  );

  if (!insights || mine.length === 0) {
    return (
      <Screen>
        {header}
        <Panel>
          <p className="font-body text-sm text-cream/60">{t.duo.empty}</p>
        </Panel>
      </Screen>
    );
  }

  const partnerOf = (d: (typeof mine)[number]) => (d.a.id === userId ? d.b : d.a);
  const duo = mine.find((d) => partnerOf(d).id === partnerId) ?? mine[0];
  const partner = partnerOf(duo);
  const me = duo.a.id === userId ? duo.a : duo.b;
  const myMama = duo.a.id === userId ? duo.mamaA : duo.mamaB;
  const theirMama = duo.a.id === userId ? duo.mamaB : duo.mamaA;
  const totalMama = myMama + theirMama;

  const ranking = insights.duos
    .filter((d) => d.games >= Math.min(5, duo.games))
    .sort((a, b) => wilsonLowerBound(b.wins, b.games) - wilsonLowerBound(a.wins, a.games));
  const duoRank = ranking.findIndex((d) => d.key === duo.key) + 1;
  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  const crewQ = crew && crew.id !== crews[0]?.id ? `&crew=${crew.id}` : "";

  return (
    <Screen>
      {header}

      <nav className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" aria-label={t.duo.noName}>
        {mine.map((d) => {
          const p = partnerOf(d);
          const active = d.key === duo.key;
          return (
            <Link
              key={d.key}
              href={`/duos?with=${p.id}${crewQ}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 h-9 px-3.5 rounded-pill flex items-center font-body text-[13px] whitespace-nowrap",
                active ? "bg-amber text-ink font-bold" : "bg-surface-panel border border-line text-cream/75 font-semibold",
              )}
            >
              + {firstName(p.name)} · {d.wins}–{d.losses}
            </Link>
          );
        })}
      </nav>

      <Panel className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex">
            <Avatar name={me.name} size={48} className="border-[3px] border-surface-deep" />
            <Avatar name={partner.name} size={48} className="-ml-3.5 border-[3px] border-surface-deep" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="font-display font-extrabold text-[28px] leading-[1.05] uppercase truncate">
              {firstName(me.name)} & {firstName(partner.name)}
            </span>
            <span className="font-body text-[13px] text-cream/55">{format(t.duo.gamesTogether, { n: duo.games })}</span>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <Kicker>{t.duo.record}</Kicker>
            <span className="font-display font-extrabold text-[60px] leading-none tabular-nums">
              <span className="text-gold">{duo.wins}</span>
              <span className="text-cream/30">–</span>
              {duo.losses}
            </span>
          </div>
          {duoRank > 0 && (
            <div className="flex flex-col items-end">
              <Kicker>{t.duo.duoRank}</Kicker>
              <span className="font-display font-extrabold text-4xl leading-none text-gold">#{duoRank}</span>
            </div>
          )}
        </div>
        <StatGrid
          items={[
            { label: t.home.winPct, value: `${duo.winPct}%` },
            { label: t.duo.bestRun, value: `${duo.bestWinStreak} W` },
            { label: t.duo.duoElo, value: duo.duoElo },
          ]}
        />
      </Panel>

      <Panel className="flex flex-col gap-2">
        <div className="flex justify-between">
          <Kicker>{t.duo.whoCarries}</Kicker>
          <span className="font-body text-xs text-cream/55">{format(t.duo.together, { n: totalMama })}</span>
        </div>
        <div className="flex h-7.5 rounded-sm overflow-hidden font-display font-extrabold text-[15px]">
          <div
            className="bg-red text-ink flex items-center pl-2.5 whitespace-nowrap"
            style={{ width: `${totalMama ? Math.max(18, (myMama / totalMama) * 100) : 50}%` }}
          >
            {firstName(me.name).toUpperCase()} {myMama}
          </div>
          <div className="flex-1 bg-surface-raised flex items-center justify-end pr-2.5 whitespace-nowrap">
            {theirMama} {firstName(partner.name).toUpperCase()}
          </div>
        </div>
      </Panel>

      <section className="flex flex-col gap-1.5" aria-label={t.duo.recent}>
        <Kicker>{t.duo.recent}</Kicker>
        {duo.recent.map((g) => (
          <Link
            key={g.gameId}
            href={`/game/${g.gameId}`}
            className="flex items-center gap-3 h-12 px-3 rounded-md bg-surface-deep border border-line text-cream"
          >
            <span
              className={cn(
                "w-7.5 h-7.5 rounded-sm flex items-center justify-center font-display font-extrabold text-[15px]",
                g.won ? "bg-amber text-ink" : "bg-surface-raised text-cream/55",
              )}
            >
              {g.won ? "W" : "L"}
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="font-body font-semibold text-sm truncate">vs {g.opponents}</span>
              <span className="font-body text-[11px] text-cream/55">
                {dateFmt.format(g.playedAt)}
                {g.mama > 0 && ` · ${g.mama} mama`}
              </span>
            </span>
            {g.won && g.streakAfter >= 2 && (
              <span className="font-heading font-bold text-[15px] text-gold">{format(t.duo.winN, { n: g.streakAfter })}</span>
            )}
          </Link>
        ))}
      </section>
    </Screen>
  );
}
