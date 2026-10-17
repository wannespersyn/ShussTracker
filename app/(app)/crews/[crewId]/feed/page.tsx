import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getCrewActivityFeed, type FeedGame } from "@/lib/db/activity";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName, nightKey } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { photoSrc } from "@/lib/photo";
import { Screen, TextTabs } from "@/components/v2";
import { ReactionIcon } from "@/components/game/ReactionIcon";

type Item =
  | {
      kind: "session";
      key: string;
      at: number;
      night: string;
      games: number;
      mvp: string | null;
      wins: number;
    }
  | { kind: "game"; key: string; at: number; game: FeedGame };

export default async function CrewFeedPage({
  params,
}: Readonly<{ params: Promise<{ crewId: string }> }>) {
  const { crewId } = await params;
  const session = await requireSession();
  const userId = session.user.id;
  try {
    await requireGroupMember(userId, crewId);
  } catch {
    notFound();
  }
  const group = await getCrew(crewId);
  if (!group) notFound();

  const [feed, insights, t, locale] = await Promise.all([
    getCrewActivityFeed(crewId, userId, 40),
    getCrewInsights(crewId),
    getT(),
    getLocale(),
  ]);
  const lang = locale === "nl" ? "nl-BE" : "en-GB";
  const dayFmt = new Intl.DateTimeFormat(lang, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const shortDay = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Brussels",
  });
  const dayOf = (d: Date) => shortDay.format(d).replace("Sept", "Sep");
  const gameMeta = (g: FeedGame) =>
    [dayOf(g.playedAt), g.mama > 0 ? format(t.feed.mamaN, { n: g.mama }) : null]
      .filter(Boolean)
      .join(" · ");

  const weekAgo = weekAgoMs();
  const score = (g: FeedGame) =>
    g.reactions.reduce((n, r) => n + r.count, 0) + g.commentCount;
  const gotw = feed
    .filter((g) => g.playedAt.getTime() > weekAgo && score(g) > 0)
    .sort((a, b) => score(b) - score(a))[0];

  const hot = insights.players.filter(
    (p) => p.streak?.kind === "W" && p.streak.n >= 3,
  );
  const climbers = insights.players
    .filter((p) => p.move >= 3)
    .sort((a, b) => b.move - a.move);

  // Games newest first; each night gets a session card above its games.
  const items: Item[] = [];
  const seenNights = new Set<string>();
  for (const g of feed) {
    if (gotw && g.id === gotw.id) continue;
    const night = nightKey(g.playedAt);
    if (!seenNights.has(night)) {
      seenNights.add(night);
      const s = insights.sessions.find((x) => x.night === night);
      if (s && s.games >= 3) {
        items.push({
          kind: "session",
          key: `s-${night}`,
          at: g.playedAt.getTime(),
          night,
          games: s.games,
          mvp: s.mvp ? firstName(s.mvp.name) : null,
          wins: s.mvp?.wins ?? 0,
        });
      }
    }
    items.push({ kind: "game", key: g.id, at: g.playedAt.getTime(), game: g });
  }

  const teamName = (names: string[]) => names.map(firstName).join(" & ");

  return (
    <Screen className="gap-3">
      <header className="h-11 flex items-center">
        <h1 className="font-display font-extrabold text-[34px] uppercase truncate">
          {group.name}
        </h1>
      </header>
      <TextTabs
        tabs={[
          {
            href: `/crews/${crewId}`,
            label: t.crew.leaderboard,
            active: false,
          },
          { href: `/crews/${crewId}/feed`, label: t.crew.feed, active: true },
          {
            href: `/crews/${crewId}/sessions`,
            label: t.crew.sessions,
            active: false,
          },
        ]}
      />

      {gotw && (
        <Link
          href={`/game/${gotw.id}`}
          className="rounded-[20px] overflow-hidden bg-surface-deep border-2 border-gold text-cream flex flex-col"
        >
          <div
            className={cn(
              "relative h-[110px]",
              !gotw.photoUrl &&
                "bg-[repeating-linear-gradient(135deg,#1a1f20_0_14px,#20262a_14px_28px)]",
            )}
          >
            {gotw.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc(gotw.id, gotw.photoUrl)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1.25 rounded-sm bg-amber text-ink font-heading font-extrabold text-[13px] tracking-[0.12em] uppercase">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
              </svg>
              {t.feed.gotw}
            </span>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-1.5">
            <span className="font-heading font-bold text-xl">
              {format(t.feed.beat, {
                a: teamName(gotw.teams[0].playerNames).toUpperCase(),
                b: teamName(
                  gotw.teams.slice(1).flatMap((x) => x.playerNames),
                ).toUpperCase(),
              })}
            </span>
            <span className="font-body text-[13px] text-muted">
              {dayOf(gotw.playedAt)} ·{" "}
              {format(t.feed.reactionsComments, {
                r: gotw.reactions.reduce((n, r) => n + r.count, 0),
                c: gotw.commentCount,
              })}
            </span>
          </div>
        </Link>
      )}

      {hot.map((p) => (
        <Row
          key={`hot-${p.userId}`}
          href={`/players/${p.userId}`}
          icon={<FlameGlyph />}
          iconClass="bg-surface-raised text-gold"
          title={format(t.feed.streak, {
            name: firstName(p.name),
            n: p.streak!.n,
          })}
          meta={t.feed.streakSub}
        />
      ))}
      {climbers.slice(0, 2).map((p) => (
        <Row
          key={`climb-${p.userId}`}
          href={`/players/${p.userId}`}
          icon={
            <span className="font-display font-extrabold text-sm">
              ▲{p.move}
            </span>
          }
          iconClass="bg-mint/15 text-mint"
          title={format(t.feed.climbed, { name: firstName(p.name), n: p.move })}
          meta={format(t.feed.climbedSub, {
            from: p.elo - p.eloWeek,
            to: p.elo,
          })}
        />
      ))}

      {items.length === 0 && !gotw && (
        <p className="font-body text-sm text-muted">{t.feed.empty}</p>
      )}

      {items.map((it) =>
        it.kind === "session" ? (
          <Row
            key={it.key}
            href={`/crews/${crewId}/sessions?night=${it.night}`}
            icon={<StarGlyph />}
            iconClass="bg-amber text-ink"
            title={format(t.feed.sessionTitle, {
              date: dayFmt.format(new Date(`${it.night}T12:00:00Z`)),
              n: it.games,
            })}
            meta={
              it.mvp
                ? format(t.feed.sessionMvp, { name: it.mvp, w: it.wins })
                : ""
            }
            right={t.feed.recap}
          />
        ) : (
          <Link
            key={it.key}
            href={`/game/${it.game.id}`}
            className="flex gap-3 items-center px-3.5 py-3 rounded-[16px] bg-surface-deep border border-cream/6 text-cream"
          >
            <span className="w-9.5 h-9.5 shrink-0 rounded-md bg-surface-raised text-soft flex items-center justify-center">
              <CapGlyph />
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-body font-semibold text-sm">
                {format(t.feed.beat, {
                  a: teamName(it.game.teams[0]?.playerNames ?? []),
                  b: it.game.teams
                    .slice(1)
                    .map((x) => teamName(x.playerNames))
                    .join(", "),
                })}
              </span>
              <span className="font-body text-xs text-muted">
                {gameMeta(it.game)}
              </span>
            </span>
            {it.game.commentCount > 0 ? (
              <span className="font-heading font-bold text-sm text-soft whitespace-nowrap">
                {format(t.feed.comments, { n: it.game.commentCount })}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-soft">
                {it.game.reactions
                  .filter((r) => r.count > 0)
                  .map((r) => (
                    <span
                      key={r.reaction}
                      className={cn(
                        "flex items-center gap-0.5 font-heading font-bold text-sm",
                        r.reactedByMe && "text-gold",
                      )}
                    >
                      <ReactionIcon reaction={r.reaction} className="w-4 h-4" />
                      {r.count}
                    </span>
                  ))}
              </span>
            )}
          </Link>
        ),
      )}
    </Screen>
  );
}

/** Server-rendered per request, so "now" is fine here. */
function weekAgoMs() {
  return Date.now() - 7 * 24 * 3600 * 1000;
}

function Row({
  href,
  icon,
  iconClass,
  title,
  meta,
  right,
}: Readonly<{
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  meta: string;
  right?: string;
}>) {
  return (
    <Link
      href={href}
      className="flex gap-3 items-center px-3.5 py-3 rounded-[16px] bg-surface-deep border border-cream/6 text-cream"
    >
      <span
        className={cn(
          "w-9.5 h-9.5 shrink-0 rounded-md flex items-center justify-center",
          iconClass,
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-body font-semibold text-sm">{title}</span>
        {meta && (
          <span className="font-body text-xs text-muted truncate">{meta}</span>
        )}
      </span>
      {right && (
        <span className="font-heading font-bold text-sm text-soft whitespace-nowrap">
          {right}
        </span>
      )}
    </Link>
  );
}

function FlameGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4.5 h-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 2 0-2-1-4 0-6z" />
    </svg>
  );
}

function StarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4.5 h-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  );
}

function CapGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4.5 h-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}
