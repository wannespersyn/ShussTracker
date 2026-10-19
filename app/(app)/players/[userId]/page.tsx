/**
 * Player profile — crew rank line, headline stats, longest win streak (vs the
 * crew record), Elo sparkline, achievements strip, nemesis and head-to-heads.
 */
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getPlayerOpponents } from "@/lib/db/players";
import { getPlayerAchievements } from "@/lib/db/player-achievements";
import { ACHIEVEMENT_ICON_PATH } from "@/lib/achievements-v2";
import { getNemesis } from "@/lib/db/h2h";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { ChartIcon, ChevronRightIcon, SettingsIcon } from "@/components/ui/icons";
import { Avatar, IconButton, Kicker, Panel, Screen, SectionHead, Sparkline, StatGrid } from "@/components/v2";

export default async function PlayerProfilePage({ params }: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { userId: viewedId } = await params;
  const session = await requireSession();
  const viewerId = session.user.id;
  const isSelf = viewerId === viewedId;

  const player = await db.query.users.findFirst({ where: eq(users.id, viewedId) });
  if (!player) notFound();
  try {
    await requireSharesCrew(viewerId, viewedId);
  } catch {
    notFound();
  }

  const [viewerCrews, playerCrews, opponents, achievements, nemesis, t, locale] = await Promise.all([
    getUserCrews(viewerId),
    getUserCrews(viewedId),
    getPlayerOpponents(viewedId),
    getPlayerAchievements(viewedId, new Date()),
    getNemesis(viewedId),
    getT(),
    getLocale(),
  ]);

  // Show the player inside the most active crew both people share.
  const shared = viewerCrews.find((c) => playerCrews.some((p) => p.id === c.id)) ?? playerCrews[0];
  const insights = shared ? await getCrewInsights(shared.id) : null;
  const me = insights?.players.find((p) => p.userId === viewedId);
  const rankedCount = insights?.players.filter((p) => p.games > 0).length ?? 0;
  const recordHolder = insights?.players.reduce<(typeof insights.players)[number] | null>(
    (best, p) => (!best || p.bestWinStreak > best.bestWinStreak ? p : best),
    null,
  );
  const holdsRecord = !!me && !!recordHolder && me.bestWinStreak >= recordHolder.bestWinStreak;
  const name = player.name ?? t.more.player;
  const earned = achievements.filter((a) => a.got);
  const nextUp = achievements.filter((a) => !a.got).sort((a, b) => b.have / b.need - a.have / a.need)[0];
  const strip = [...[...earned].sort((a, b) => b.need - a.need).slice(0, nextUp ? 3 : 4), ...(nextUp ? [nextUp] : [])];
  const history = me?.eloHistory ?? [];
  const eloDelta = history.length > 1 ? history[history.length - 1].elo - 1000 : 0;
  const sinceLabel = history[0]
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(`${history[0].date}T12:00:00Z`),
      ).replace("Sept", "Sep")
    : "";

  return (
    <Screen>
      <header className="flex items-center gap-3.5 pt-1">
        <Avatar name={name} size={70} fontSize={24} className="border-[3px] border-gold font-display! font-extrabold!" />
        <div className="flex-1 min-w-0 flex flex-col">
          <h1 className="font-display font-extrabold text-[30px] leading-[1.05] uppercase truncate">{name}</h1>
          {me && shared && me.games > 0 && (
            <span className="font-body text-[13px] text-muted truncate">
              {format(t.profile.rankLine, { crew: shared.name, r: me.rank, n: rankedCount, e: me.elo })}
            </span>
          )}
        </div>
        {isSelf && (
          <IconButton href="/settings" label={t.settings.title}>
            <SettingsIcon />
          </IconButton>
        )}
      </header>

      {me && me.games > 0 ? (
        <>
          <StatGrid
            className="rounded-[16px] border border-line"
            flat
            items={[
              { label: t.home.games, value: me.games },
              { label: "W–L", value: `${me.wins}–${me.losses}` },
              { label: t.home.winPct, value: `${me.winPct}%`, tone: "gold" },
              { label: t.common.mama, value: me.mama, tone: "red" },
            ]}
          />
          {me.bestWinStreak > 0 && (
            <Panel className={cn("flex items-center gap-3.5 px-4 py-3.5 rounded-[18px]", holdsRecord && "border-[#ff7a2f]/60")}>
              <svg viewBox="0 0 24 24" className="w-9 h-9 shrink-0 text-[#ff7a2f]" fill="currentColor" aria-hidden="true">
                <path d="M12 2c1.2 4.4 5.5 6.4 5.5 12a5.5 5.5 0 0 1-11 0c0-3.4 2.2-4.6 2.2-7.6 1.1 1.1 2.2 2.2 3.3 2.2 0-2.2-1.1-4.4 0-6.6z" />
              </svg>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <Kicker>{t.profile.bestStreak}</Kicker>
                <span className="font-body text-xs text-muted truncate">
                  {holdsRecord
                    ? t.profile.streakRecord
                    : format(t.profile.streakVsRecord, { n: recordHolder!.bestWinStreak, name: firstName(recordHolder!.name) })}
                  {me.streak?.kind === "W" && me.streak.n > 0 && ` · ${format(t.profile.streakNow, { n: me.streak.n })}`}
                </span>
              </span>
              <span className="font-display font-extrabold text-[40px] leading-none tabular-nums text-[#ff7a2f]">{me.bestWinStreak}W</span>
            </Panel>
          )}
          {history.length > 1 && (
            <Panel className="flex flex-col gap-2 px-4 py-3.5 rounded-[18px]">
              <div className="flex justify-between items-baseline">
                <Kicker>{format(t.profile.eloSince, { d: sinceLabel })}</Kicker>
                <span className={cn("font-heading font-bold text-[15px]", eloDelta >= 0 ? "text-mint" : "text-red")}>
                  {eloDelta >= 0 ? "▲" : "▼"} {Math.abs(eloDelta)}
                </span>
              </div>
              <Sparkline
                values={[1000, ...history.map((h) => h.elo)]}
                label={format(t.more.eloWent, { n: history[history.length - 1].elo })}
              />
            </Panel>
          )}
        </>
      ) : (
        <Panel className="text-center py-8">
          <div className="font-display font-extrabold text-2xl uppercase">{t.home.noGamesTitle}</div>
          <p className="font-body text-sm text-muted mt-1">{t.home.noGamesBody}</p>
        </Panel>
      )}

      <section className="flex flex-col gap-2">
        <SectionHead
          title={format(t.profile.achievements, { n: earned.length, t: achievements.length })}
          href={`/players/${viewedId}/achievements`}
          linkLabel={t.common.seeAll}
        />
        <div className="grid grid-cols-4 gap-2">
          {strip.map((a) => (
            <div
              key={a.id}
              className={cn(
                "aspect-square rounded-[14px] flex flex-col items-center justify-center gap-1 p-1 text-center",
                a.got ? "bg-surface-raised border border-gold/40 text-gold" : "bg-surface-deep border border-dashed border-cream/14 text-[#5b6460]",
              )}
              title={a.desc}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                <path d={a.got ? ACHIEVEMENT_ICON_PATH[a.icon] : "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3"} />
              </svg>
              <span className="font-body font-bold text-[10px] leading-[1.15]! tracking-[0.04em]">{a.name}</span>
            </div>
          ))}
        </div>
      </section>

      {isSelf && (
        <Link
          href="/stats"
          className="h-[50px] rounded-[14px] border border-cream/14 text-cream flex items-center justify-center gap-2 font-body font-semibold text-[15px]"
        >
          <ChartIcon className="w-4.5 h-4.5" />
          {t.profile.deepStats}
        </Link>
      )}

      {shared && insights && insights.totalGames > 0 && (
        <Link href={`/crews/${shared.id}/recap`} className="flex items-center gap-3 px-4 py-3.5 rounded-[18px] bg-amber text-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M9 8h6M9 12h6M9 16h3" />
          </svg>
          <span className="flex-1 flex flex-col">
            <span className="font-heading font-extrabold text-[19px] tracking-[0.04em] uppercase">{t.profile.recap}</span>
            <span className="font-body text-xs font-medium">{t.profile.recapSub}</span>
          </span>
          <ChevronRightIcon className="w-4.5 h-4.5" />
        </Link>
      )}

      {nemesis && (
        <Link
          href={`/players/${viewedId}/vs/${nemesis.opponentId}`}
          className="flex items-center gap-3.5 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-red/35 text-cream"
        >
          <Avatar name={nemesis.opponentName} size={42} />
          <span className="flex-1 min-w-0 flex flex-col">
            <Kicker className="text-red">{t.more.nemesis}</Kicker>
            <span className="font-body font-semibold text-[15px] truncate">{nemesis.opponentName}</span>
            <span className="font-body text-xs text-muted">
              {nemesis.wins}W–{nemesis.losses}L
            </span>
          </span>
          <span className="font-display font-extrabold text-2xl text-red">
            {Math.round((nemesis.losses / (nemesis.wins + nemesis.losses)) * 100)}%
          </span>
        </Link>
      )}

      {opponents.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <Kicker>{t.profile.vs}</Kicker>
          {opponents.slice(0, 8).map((o) => (
            <Link
              key={o.userId}
              href={`/players/${viewedId}/vs/${o.userId}`}
              className="flex items-center gap-3 h-12 px-3 rounded-md bg-surface-deep border border-line text-cream"
            >
              <Avatar name={o.name} />
              <span className="flex-1 font-body font-semibold text-[15px] truncate">{firstName(o.name)}</span>
              <span className="font-body text-xs text-muted">{o.timesPlayed}×</span>
              <ChevronRightIcon className="w-4 h-4 text-muted" />
            </Link>
          ))}
        </section>
      )}
    </Screen>
  );
}
