import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewGuests } from "@/lib/db/guests";
import { getGroupTournaments } from "@/lib/db/tournaments";
import { addGuestAction, removeGuestAction } from "./guests/actions";
import { leaveCrew } from "@/app/(app)/crews/actions";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName, type DuoInsight, type PlayerInsight } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { wilsonLowerBound } from "@/lib/ranking";
import { isPro } from "@/lib/plan";
import { ConfirmForm } from "@/components/ui";
import { ChevronRightIcon, PlusIcon, SettingsIcon, TrophyIcon } from "@/components/ui/icons";
import { Chip, FormDots, IconButton, Kicker, MoveChip, Screen, SegmentLinks, TextTabs } from "@/components/v2";

const GRID = "grid grid-cols-[28px_minmax(0,1fr)_56px_46px_54px] gap-1.5 items-center";

export default async function CrewPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ crewId: string }>; searchParams: Promise<{ view?: string }> }>) {
  const [{ crewId }, { view }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  const userId = session.user.id;

  try {
    await requireGroupMember(userId, crewId);
  } catch {
    notFound();
  }

  const group = await getCrew(crewId);
  if (!group) notFound();

  const [insights, guests, tournamentList, t, locale] = await Promise.all([
    getCrewInsights(crewId),
    getCrewGuests(crewId),
    getGroupTournaments(crewId),
    getT(),
    getLocale(),
  ]);
  const isOwner = group.createdBy === userId;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "shussapp.vercel.app"}`;
  const showDuos = view === "duos";
  const ranked = insights.players.filter((p) => p.games > 0);
  const unplayed = insights.players.filter((p) => p.games === 0);
  const activeTournaments = tournamentList.filter((x) => x.status !== "completed");
  const since = insights.firstGameAt
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" }).format(insights.firstGameAt)
    : null;

  const minDuoGames = insights.duos.some((d) => d.games >= 5) ? 5 : 1;
  const duos = insights.duos
    .filter((d) => d.games >= minDuoGames)
    .sort((a, b) => wilsonLowerBound(b.wins, b.games) - wilsonLowerBound(a.wins, a.games) || b.games - a.games);
  const recordStreak = Math.max(0, ...insights.duos.map((d) => d.bestWinStreak));
  const mostPlayed = Math.max(0, ...insights.duos.map((d) => d.games));

  return (
    <Screen>
      <header className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center h-11 gap-2">
          <h1 className="font-display font-extrabold text-[34px] tracking-[0.02em] uppercase truncate">{group.name}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <IconButton href={`/log?crewId=${crewId}`} label={t.nav.log}>
              <PlusIcon />
            </IconButton>
            {isOwner && (
              <IconButton href={`/crews/${crewId}/manage`} label={t.crew.manage}>
                <SettingsIcon />
              </IconButton>
            )}
          </div>
        </div>
        {group.plan === "founding" && isPro(group) && (
          <span className="self-start flex items-center gap-1.5 h-7 px-2.5 rounded-sm border border-gold text-gold font-heading font-bold text-[13px] tracking-[0.1em] uppercase">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
              <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
            </svg>
            {t.crew.founding}
          </span>
        )}
        <span className="font-body text-[13px] text-cream/55">
          {format(t.crew.meta, { p: ranked.length, g: insights.totalGames })}
          {since && ` · ${format(t.crew.since, { d: since })}`}
        </span>
      </header>

      <TextTabs
        tabs={[
          { href: `/crews/${crewId}`, label: t.crew.leaderboard, active: true },
          { href: `/crews/${crewId}/feed`, label: t.crew.feed, active: false },
          { href: `/crews/${crewId}/sessions`, label: t.crew.sessions, active: false },
        ]}
      />

      <SegmentLinks
        options={[
          { href: `/crews/${crewId}`, label: t.crew.players, active: !showDuos },
          { href: `/crews/${crewId}?view=duos`, label: t.crew.duos, active: showDuos },
        ]}
      />

      <section className="rounded-[18px] bg-surface-deep border border-line overflow-hidden" aria-label={t.crew.leaderboard}>
        <div className={cn(GRID, "px-3.5 py-2.5 border-b border-line font-heading font-semibold text-[12px] tracking-[0.12em] uppercase text-cream/55")}>
          <span>#</span>
          <span>{showDuos ? t.crew.colDuo : t.crew.colPlayer}</span>
          <span className="text-right">{t.crew.colWl}</span>
          <span className="text-right">{t.crew.colWin}</span>
          <span className="text-right">{t.crew.colElo}</span>
        </div>
        {showDuos ? (
          duos.length === 0 ? (
            <p className="px-3.5 py-4 font-body text-sm text-cream/55">{t.crew.noDuos}</p>
          ) : (
            duos.map((d, i) => (
              <DuoRow key={d.key} duo={d} index={i} userId={userId} recordStreak={recordStreak} mostPlayed={mostPlayed} t={t} />
            ))
          )
        ) : (
          [...ranked, ...unplayed].map((p, i) => <PlayerRow key={p.userId} p={p} index={i} userId={userId} t={t} />)
        )}
      </section>
      {showDuos && minDuoGames > 1 && <span className="font-body text-xs text-cream/45 -mt-1.5">{format(t.crew.minGames, { n: minDuoGames })}</span>}

      <Link
        href={activeTournaments[0] ? `/tournaments/${activeTournaments[0].id}` : `/tournaments/new?crewId=${crewId}`}
        className="flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-surface-deep border border-line text-cream"
      >
        <span className="w-10 h-10 rounded-md bg-surface-raised text-gold flex items-center justify-center">
          <TrophyIcon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-body font-semibold text-[15px] truncate">{activeTournaments[0]?.name ?? t.crew.tournament}</span>
          <span className="font-body text-xs text-cream/55">{t.crew.tournamentSub}</span>
        </span>
        <ChevronRightIcon className="w-4 h-4 text-cream/55" />
      </Link>

      <section className="flex flex-col gap-2" aria-label={t.common.guest}>
        <Kicker>{t.crew.addGuest}</Kicker>
        {guests.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-md bg-surface-deep border border-line px-3.5 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="font-body font-semibold text-[15px] truncate">{g.name}</div>
              {g.claimToken && (
                <div className="font-body text-xs text-cream/55">
                  Claim code <span className="font-heading font-bold tracking-[0.12em] text-gold">{g.claimToken}</span>
                </div>
              )}
            </div>
            {g.claimToken && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(format(t.crew.claimMessage, { name: g.name, crew: group.name, url: `${origin}/claim?code=${g.claimToken}`, code: g.claimToken }))}`}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 rounded-pill bg-amber text-ink font-heading font-bold text-xs tracking-[0.06em] uppercase flex items-center"
              >
                {t.crew.sendClaim}
              </a>
            )}
            {isOwner && (
              <ConfirmForm action={removeGuestAction.bind(null, crewId, g.id)} confirmMessage={`Remove guest ${g.name}?`}>
                <button type="submit" className="font-heading font-bold text-xs tracking-[0.1em] uppercase text-red">
                  Remove
                </button>
              </ConfirmForm>
            )}
          </div>
        ))}
        <form action={addGuestAction.bind(null, crewId)} className="flex gap-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Guest's name"
            aria-label="Guest's name"
            className="flex-1 h-11 rounded-md bg-surface-panel border border-line px-3.5 font-body text-sm text-cream placeholder:text-cream/40 outline-none focus:border-gold/60"
          />
          <button type="submit" className="h-11 px-4 rounded-md bg-amber font-heading font-bold text-sm uppercase text-ink">
            {t.crew.addGuest}
          </button>
        </form>
      </section>

      <div className="flex items-center justify-center gap-5 pt-1">
        {insights.totalGames > 0 && (
          <Link href={`/crews/${crewId}/recap`} className="font-heading font-bold text-xs tracking-[0.1em] uppercase text-gold">
            Season recap
          </Link>
        )}
        <Link href="/claim" className="font-heading font-bold text-xs tracking-[0.1em] uppercase text-cream/55">
          Claim a guest
        </Link>
        {!isOwner && (
          <ConfirmForm action={leaveCrew.bind(null, crewId)} confirmMessage={`Leave ${group.name}?`}>
            <button type="submit" className="font-heading font-bold text-xs tracking-[0.1em] uppercase text-cream/40">
              Leave crew
            </button>
          </ConfirmForm>
        )}
      </div>
    </Screen>
  );
}

type T = Awaited<ReturnType<typeof getT>>;

function PlayerRow({ p, index, userId, t }: Readonly<{ p: PlayerInsight; index: number; userId: string; t: T }>) {
  const isMe = p.userId === userId;
  const played = p.games > 0;
  return (
    <Link
      href={`/players/${p.userId}`}
      className={cn(
        GRID,
        "min-h-12 px-3.5 py-1 border-b border-line last:border-b-0 text-cream",
        isMe && "bg-surface-raised shadow-[inset_3px_0_0_var(--color-gold)]",
      )}
    >
      <span className={cn("font-display font-extrabold text-lg", index === 0 && played ? "text-gold" : "text-cream/55")}>
        {played ? index + 1 : "–"}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="font-body font-semibold text-[15px] truncate">{firstName(p.name)}</span>
        <span className="flex items-center gap-1.25 mt-0.75 overflow-hidden">
          {played && <MoveChip move={p.move} />}
          {p.streak && p.streak.kind === "W" && p.streak.n >= 3 && <Chip tone="hot">{format(t.crew.streak, { n: p.streak.n })}</Chip>}
          {p.isGuest && <Chip tone="guest">{t.common.guest.toUpperCase()}</Chip>}
          <FormDots form={p.form.slice(-5)} />
        </span>
      </span>
      <span className="text-right font-display font-semibold text-[17px] tabular-nums">{played ? `${p.wins}–${p.losses}` : "—"}</span>
      <span className="text-right font-display font-semibold text-[17px] text-cream/75">{played ? `${p.winPct}%` : ""}</span>
      <span className="text-right font-display font-extrabold text-[19px] tabular-nums">{p.elo}</span>
    </Link>
  );
}

function DuoRow({
  duo,
  index,
  userId,
  recordStreak,
  mostPlayed,
  t,
}: Readonly<{ duo: DuoInsight; index: number; userId: string; recordStreak: number; mostPlayed: number; t: T }>) {
  const mine = duo.a.id === userId || duo.b.id === userId;
  const partner = duo.a.id === userId ? duo.b : duo.a;
  const href = mine ? `/duos?with=${partner.id}` : `/players/${duo.a.id}`;
  return (
    <Link
      href={href}
      className={cn(
        GRID,
        "min-h-12 px-3.5 py-1 border-b border-line last:border-b-0 text-cream",
        mine && "bg-surface-raised shadow-[inset_3px_0_0_var(--color-gold)]",
      )}
    >
      <span className={cn("font-display font-extrabold text-lg", index === 0 ? "text-gold" : "text-cream/55")}>{index + 1}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-body font-semibold text-[15px] truncate">
          {firstName(duo.a.name)} & {firstName(duo.b.name)}
        </span>
        <span className="flex items-center gap-1.25 mt-0.75 overflow-hidden">
          {duo.bestWinStreak === recordStreak && recordStreak >= 3 && <Chip tone="hot">{format(t.crew.record, { n: recordStreak })}</Chip>}
          {duo.games === mostPlayed && <Chip tone="info">{t.crew.mostPlayed.toUpperCase()}</Chip>}
        </span>
      </span>
      <span className="text-right font-display font-semibold text-[17px] tabular-nums">
        {duo.wins}–{duo.losses}
      </span>
      <span className="text-right font-display font-semibold text-[17px] text-cream/75">{duo.winPct}%</span>
      <span className="text-right font-display font-extrabold text-[19px] tabular-nums">{duo.duoElo}</span>
    </Link>
  );
}
