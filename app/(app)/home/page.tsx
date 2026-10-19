import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getFlair, getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui";
import {
  FlameIcon,
  PlusIcon,
  SettingsIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import {
  Avatar,
  FormStrip,
  IconButton,
  Kicker,
  Panel,
  Screen,
  SectionHead,
  StatGrid,
} from "@/components/v2";

export default async function HomePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ crew?: string }> }>) {
  const session = await requireSession();
  const userId = session.user.id;
  const [{ crew: crewParam }, crews, t, locale, flair] = await Promise.all([
    searchParams,
    getUserCrews(userId),
    getT(),
    getLocale(),
    getFlair(),
  ]);
  const crew = crews.find((c) => c.id === crewParam) ?? crews[0];

  const header = (
    <header className="flex items-center justify-between h-11">
      <div className="flex items-center gap-2.5">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle
            cx="15"
            cy="15"
            r="13"
            fill="none"
            stroke="var(--color-nav-active)"
            strokeWidth="2.5"
            strokeDasharray="3 2.2"
          />
          <circle cx="15" cy="15" r="8" fill="var(--color-amber-fill)" />
        </svg>
        <span className="font-heading font-extrabold text-[22px] tracking-[0.06em]">
          SHUSSAPP
        </span>
      </div>
      <div className="flex items-center gap-2">
        {crew && (
          <Link
            href="/crews"
            aria-label={t.home.switchCrew}
            className="h-9 px-3 rounded-pill bg-surface-panel border border-line-strong text-cream font-body font-semibold text-[13px] flex items-center gap-1.5 max-w-40"
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
          <div className="font-display font-extrabold text-3xl uppercase">
            {t.home.noCrewTitle}
          </div>
          <p className="font-body text-sm text-muted max-w-70">
            {t.home.noCrewBody}
          </p>
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

  const onFire = flair && me?.streak?.kind === "W" && me.streak.n >= 3;
  const chasers = ranked
    .filter((p) => p.userId !== userId)
    .slice(0, 2)
    .map((p) => firstName(p.name));
  const highlight =
    me?.streak && me.streak.kind === "W" && me.streak.n >= 3
      ? format(t.home.winStreak, { n: me.streak.n })
      : me && mamaLeader && mamaLeader.userId === me.userId && me.mama > 0
        ? format(t.home.mamaKing, { crew: crew.name })
        : me && me.move > 0
          ? format(t.home.placesUp, { n: me.move })
          : null;

  const nightLabel = (night: string) =>
    new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(new Date(`${night}T12:00:00Z`))
      .toUpperCase()
      .split(" ");

  return (
    <Screen className={onFire ? "on-fire" : undefined}>
      {header}

      {onFire && me?.streak && (
        <section
          className="rounded-[22px] bg-[#ff7a2f] text-[#160a04] p-4.5 flex items-center gap-3.5"
          aria-label={t.home.onFire}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-16 h-16 shrink-0 motion-safe:animate-flicker"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c1.2 4.4 5.5 6.4 5.5 12a5.5 5.5 0 0 1-11 0c0-3.4 2.2-4.6 2.2-7.6 1.1 1.1 2.2 2.2 3.3 2.2 0-2.2-1.1-4.4 0-6.6z" />
          </svg>
          <span className="flex flex-col">
            <span className="font-display font-extrabold text-[46px] leading-[0.95]! uppercase">
              {t.home.onFire}
            </span>
            <span className="font-heading font-bold text-[19px] tracking-[0.04em] uppercase">
              {format(t.home.onFireSub, {
                n: me.streak.n,
                b: me.bestWinStreak,
              })}
            </span>
          </span>
        </section>
      )}

      {!me || me.games === 0 ? (
        <Panel className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display font-extrabold text-3xl uppercase">
            {t.home.noGamesTitle}
          </div>
          <p className="font-body text-sm text-muted max-w-70">
            {t.home.noGamesBody}
          </p>
        </Panel>
      ) : (
        <Panel className="hero-invert flex flex-col gap-3.5">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <Kicker>
                {onFire
                  ? t.home.crewRankShort
                  : format(t.home.crewRank, { y: currentYear() })}
              </Kicker>
              <div className="flex items-baseline gap-2.5">
                <span className={cn("font-display font-extrabold leading-none text-gold", onFire ? "text-[60px]" : "text-[64px]")}>
                  #{me.rank}
                </span>
                <span
                  className={cn(
                    "font-heading font-semibold text-[15px] text-muted",
                    onFire && "hidden",
                  )}
                >
                  {format(t.home.of, { n: ranked.length })}
                  {me.move !== 0 &&
                    ` · ${me.move > 0 ? "▲" : "▼"}${Math.abs(me.move)}`}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Kicker>{t.home.elo}</Kicker>
              <span className="font-display font-bold text-[34px] leading-none tabular-nums">
                {me.elo}
              </span>
              {me.eloWeek !== 0 && (
                <span
                  className={cn(
                    "font-heading font-semibold text-[13px]",
                    me.eloWeek > 0 ? "text-mint" : "text-red",
                  )}
                >
                  {format(t.home.thisWeek, {
                    d: `${me.eloWeek > 0 ? "▲" : "▼"} ${Math.abs(me.eloWeek)}`,
                  })}
                </span>
              )}
            </div>
          </div>
          {!onFire && (
            <StatGrid
              items={[
                { label: t.home.winPct, value: `${me.winPct}%` },
                { label: t.home.games, value: me.games },
                { label: t.home.mama, value: me.mama, tone: "red" },
              ]}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <div
              className={cn(
                "flex justify-between items-center",
                onFire && "hidden",
              )}
            >
              <span className="font-body font-semibold text-[11px] tracking-[0.08em] uppercase text-muted">
                {t.home.last10}
              </span>
              {highlight && (
                <span className="flex items-center gap-1 font-heading font-bold text-sm uppercase text-gold">
                  <FlameIcon className="w-3.5 h-3.5" />
                  {highlight}
                </span>
              )}
            </div>
            <FormStrip
              form={me.form}
              hot={onFire && me.streak ? me.streak.n : 0}
            />
          </div>
        </Panel>
      )}

      <Link
        href={`/log?crewId=${crew.id}`}
        className="h-14 rounded-lg bg-amber text-ink flex items-center justify-center gap-2.5 font-heading font-extrabold text-xl tracking-[0.06em] uppercase"
      >
        {onFire ? (
          t.home.keepGoing
        ) : (
          <>
            <PlusIcon className="w-5 h-5" />
            {t.home.logGame}
          </>
        )}
      </Link>

      {onFire && chasers.length > 0 && (
        <div className="flex gap-2.5 items-center px-3.5 py-3 rounded-[14px] bg-surface-deep border border-dashed border-gold/40 font-body text-[13px] leading-[1.35]!">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="2"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span>
            {format(t.home.chasers, {
              names: chasers.join(chasers.length > 1 ? t.home.and : ""),
            })}{" "}
            <strong>{t.ach.streakBreaker}</strong>.
          </span>
        </div>
      )}

      {lastSession && !onFire && (
        <Link
          href={`/crews/${crew.id}/sessions`}
          className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-line text-cream"
        >
          <span className="w-11 h-11 shrink-0 rounded-md bg-surface-raised flex flex-col items-center justify-center leading-none">
            <span className="font-body font-bold text-[10px] text-muted">
              {nightLabel(lastSession.night)[1]}
            </span>
            <span className="font-display font-extrabold text-xl">
              {nightLabel(lastSession.night)[0]}
            </span>
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <Kicker>
              {format(t.home.lastSession, { n: lastSession.games })}
            </Kicker>
            <span className="font-body font-semibold text-[15px] truncate">
              {lastSession.mvp?.userId === userId
                ? myLine && myLine.mama > 0
                  ? format(t.home.youMvpMama, {
                      w: lastSession.mvp.wins,
                      m: myLine.mama,
                    })
                  : format(t.home.youMvp, { w: lastSession.mvp.wins })
                : myLine
                  ? format(t.home.youPlayed, {
                      w: myLine.wins,
                      g: myLine.games,
                    })
                  : lastSession.mvp
                    ? format(t.home.mvpWas, {
                        name: firstName(lastSession.mvp.name),
                        w: lastSession.mvp.wins,
                      })
                    : ""}
            </span>
          </span>
          <ChevronRightIcon className="w-4 h-4 text-muted" />
        </Link>
      )}

      {top3.length > 0 && !onFire && (
        <section
          className="flex flex-col gap-1.5"
          aria-label={format(t.home.top3, { crew: crew.name })}
        >
          <SectionHead
            title={format(t.home.top3, { crew: crew.name })}
            href={`/crews/${crew.id}`}
            linkLabel={t.common.seeAll}
          />
          {top3.map((p) => {
            const isMe = p.userId === userId;
            return (
              <Link
                key={p.userId}
                href={`/players/${p.userId}`}
                className={cn(
                  "flex items-center gap-3 h-12 px-3 rounded-md border text-cream",
                  isMe
                    ? "me-row bg-surface-raised border-gold/35"
                    : "bg-surface-deep border-cream/6",
                )}
              >
                <span className="w-5.5 font-display font-extrabold text-xl text-muted">
                  {p.rank}
                </span>
                <Avatar name={p.name} />
                <span className="flex-1 font-body font-semibold text-[15px] truncate">
                  {firstName(p.name)}
                  {isMe && ` (${t.common.you.toLowerCase()})`}
                </span>
                <span className="font-display font-bold text-xl tabular-nums">
                  {p.elo}
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </Screen>
  );
}

/** Server-rendered per request, so "now" is fine here. */
function currentYear() {
  return new Date().getFullYear();
}
