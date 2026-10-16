import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui";
import { FlameIcon, PlusIcon, SettingsIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Avatar, FormStrip, IconButton, Kicker, Panel, Screen, SectionHead, StatGrid } from "@/components/v2";

export default async function HomePage({ searchParams }: Readonly<{ searchParams: Promise<{ crew?: string }> }>) {
  const session = await requireSession();
  const userId = session.user.id;
  const [{ crew: crewParam }, crews, t, locale] = await Promise.all([searchParams, getUserCrews(userId), getT(), getLocale()]);
  const crew = crews.find((c) => c.id === crewParam) ?? crews[0];

  const header = (
    <header className="flex items-center justify-between h-11">
      <div className="flex items-center gap-2.5">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeDasharray="3 2.2" />
          <circle cx="15" cy="15" r="8" fill="var(--color-gold)" />
        </svg>
        <span className="font-heading font-extrabold text-[22px] tracking-[0.06em]">SHUSSAPP</span>
      </div>
      <div className="flex items-center gap-2">
        {crew && (
          <Link
            href="/crews"
            aria-label={t.home.switchCrew}
            className="h-9 px-3 rounded-pill bg-surface-panel border border-line text-cream font-body font-semibold text-[13px] flex items-center gap-1.5 max-w-40"
          >
            <span className="truncate">{crew.name}</span>
            <ChevronRightIcon className="w-3.5 h-3.5 rotate-90 shrink-0" />
          </Link>
        )}
        <IconButton href="/settings" label={t.settings.title}>
          <SettingsIcon />
        </IconButton>
      </div>
    </header>
  );

  if (!crew) {
    return (
      <Screen>
        {header}
        <Panel className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display font-extrabold text-3xl uppercase">{t.home.noCrewTitle}</div>
          <p className="font-body text-sm text-cream/60 max-w-70">{t.home.noCrewBody}</p>
          <LinkButton href="/crews">{t.home.findCrew}</LinkButton>
        </Panel>
      </Screen>
    );
  }

  const insights = await getCrewInsights(crew.id);
  const me = insights.players.find((p) => p.userId === userId);
  const ranked = insights.players.filter((p) => p.games > 0);
  const top3 = ranked.slice(0, 3);
  const mamaLeader = [...ranked].sort((a, b) => b.mama - a.mama)[0];
  const lastSession = insights.sessions[0];
  const myLine = lastSession?.lines.find((l) => l.userId === userId);

  const highlight =
    me?.streak && me.streak.kind === "W" && me.streak.n >= 3
      ? format(t.home.winStreak, { n: me.streak.n })
      : me && mamaLeader && mamaLeader.userId === me.userId && me.mama > 0
        ? format(t.home.mamaKing, { crew: crew.name })
        : me && me.move > 0
          ? format(t.home.placesUp, { n: me.move })
          : null;

  const nightLabel = (night: string) =>
    new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(`${night}T12:00:00Z`))
      .toUpperCase()
      .split(" ");

  return (
    <Screen>
      {header}

      {!me || me.games === 0 ? (
        <Panel className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display font-extrabold text-3xl uppercase">{t.home.noGamesTitle}</div>
          <p className="font-body text-sm text-cream/60 max-w-70">{t.home.noGamesBody}</p>
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-3.5">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <Kicker>{t.home.crewRank}</Kicker>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display font-extrabold text-[64px] leading-none text-gold">#{me.rank}</span>
                <span className="font-heading font-semibold text-[15px] text-cream/55">
                  {format(t.home.of, { n: ranked.length })}
                  {me.move !== 0 && (
                    <span className={cn("ml-1.5", me.move > 0 ? "text-mint" : "text-red")}>
                      {me.move > 0 ? "▲" : "▼"}
                      {Math.abs(me.move)}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Kicker>{t.home.elo}</Kicker>
              <span className="font-display font-bold text-[34px] leading-none">{me.elo}</span>
              {me.eloWeek !== 0 && (
                <span className={cn("font-heading font-semibold text-[13px]", me.eloWeek > 0 ? "text-mint" : "text-red")}>
                  {format(t.home.thisWeek, { d: `${me.eloWeek > 0 ? "▲" : "▼"} ${Math.abs(me.eloWeek)}` })}
                </span>
              )}
            </div>
          </div>
          <StatGrid
            items={[
              { label: t.home.winPct, value: `${me.winPct}%` },
              { label: t.home.games, value: me.games },
              { label: t.home.mama, value: me.mama, tone: "red" },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="font-body font-semibold text-[11px] tracking-[0.08em] uppercase text-cream/55">{t.home.last10}</span>
              {highlight && (
                <span className="flex items-center gap-1 font-heading font-bold text-sm uppercase text-gold">
                  <FlameIcon className="w-3.5 h-3.5" />
                  {highlight}
                </span>
              )}
            </div>
            <FormStrip form={me.form} />
          </div>
        </Panel>
      )}

      <Link
        href={`/log?crewId=${crew.id}`}
        className="h-14 rounded-lg bg-amber text-ink flex items-center justify-center gap-2.5 font-heading font-extrabold text-xl tracking-[0.06em] uppercase"
      >
        <PlusIcon className="w-5 h-5" />
        {t.home.logGame}
      </Link>

      {lastSession && (
        <Link
          href={`/crews/${crew.id}/sessions`}
          className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-line text-cream"
        >
          <span className="w-11 h-11 shrink-0 rounded-md bg-surface-raised flex flex-col items-center justify-center leading-none">
            <span className="font-body font-bold text-[10px] text-cream/55">{nightLabel(lastSession.night)[1]}</span>
            <span className="font-display font-extrabold text-xl">{nightLabel(lastSession.night)[0]}</span>
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <Kicker>{format(t.home.lastSession, { n: lastSession.games })}</Kicker>
            <span className="font-body font-semibold text-[15px] truncate">
              {lastSession.mvp?.userId === userId
                ? format(t.home.youMvp, { w: lastSession.mvp.wins })
                : myLine
                  ? format(t.home.youPlayed, { w: myLine.wins, g: myLine.games })
                  : lastSession.mvp
                    ? format(t.home.mvpWas, { name: firstName(lastSession.mvp.name), w: lastSession.mvp.wins })
                    : ""}
            </span>
          </span>
          <ChevronRightIcon className="w-4 h-4 text-cream/55" />
        </Link>
      )}

      {top3.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label={format(t.home.top3, { crew: crew.name })}>
          <SectionHead title={format(t.home.top3, { crew: crew.name })} href={`/crews/${crew.id}`} linkLabel={t.common.seeAll} />
          {top3.map((p) => {
            const isMe = p.userId === userId;
            return (
              <Link
                key={p.userId}
                href={`/players/${p.userId}`}
                className={cn(
                  "flex items-center gap-3 h-12 px-3 rounded-md border text-cream",
                  isMe ? "bg-surface-raised border-line shadow-[inset_3px_0_0_var(--color-gold)]" : "bg-surface-deep border-line",
                )}
              >
                <span className={cn("w-5.5 font-display font-extrabold text-xl", p.rank === 1 ? "text-gold" : "text-cream/55")}>{p.rank}</span>
                <Avatar name={p.name} />
                <span className="flex-1 font-body font-semibold text-[15px] truncate">
                  {p.name}
                  {isMe && <span className="text-cream/55 font-medium"> ({t.common.you.toLowerCase()})</span>}
                </span>
                <span className="font-display font-bold text-xl tabular-nums">{p.elo}</span>
              </Link>
            );
          })}
        </section>
      )}
    </Screen>
  );
}
