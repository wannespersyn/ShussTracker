import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { Avatar, Kicker, Panel, Screen, TextTabs } from "@/components/v2";

export default async function SessionsPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ crewId: string }>; searchParams: Promise<{ night?: string }> }>) {
  const [{ crewId }, { night }] = await Promise.all([params, searchParams]);
  const session = await requireSession();
  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }
  const group = await getCrew(crewId);
  if (!group) notFound();

  const [insights, t, locale] = await Promise.all([getCrewInsights(crewId), getT(), getLocale()]);
  const lang = locale === "nl" ? "nl-BE" : "en-GB";
  const longFmt = new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const shortFmt = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const asDate = (n: string) => new Date(`${n}T12:00:00Z`);

  const s = insights.sessions.find((x) => x.night === night) ?? insights.sessions[0];
  const tabs = (
    <TextTabs
      tabs={[
        { href: `/crews/${crewId}`, label: t.crew.leaderboard, active: false },
        { href: `/crews/${crewId}/feed`, label: t.crew.feed, active: false },
        { href: `/crews/${crewId}/sessions`, label: t.crew.sessions, active: true },
      ]}
    />
  );

  if (!s) {
    return (
      <Screen>
        <h1 className="font-display font-extrabold text-[34px] uppercase h-11">{group.name}</h1>
        {tabs}
        <p className="font-body text-sm text-cream/55">{t.sessions.empty}</p>
      </Screen>
    );
  }

  const climber = s.movers[0];
  const maxAbs = Math.max(1, ...s.movers.map((m) => Math.abs(m.delta)));

  return (
    <Screen>
      <h1 className="font-display font-extrabold text-[34px] uppercase h-11 truncate">{group.name}</h1>
      {tabs}

      <header className="flex flex-col">
        <span className="font-display font-extrabold text-[26px] uppercase tracking-[0.03em]">{longFmt.format(asDate(s.night))}</span>
        <span className="font-body text-[13px] text-cream/55">{format(t.sessions.meta, { g: s.games, p: s.players })}</span>
      </header>

      {s.mvp && (
        <section className="rounded-[20px] bg-amber text-ink px-4.5 py-4 flex items-center gap-3.5">
          <span className="w-14 h-14 rounded-pill bg-ink text-[#ffb627] flex items-center justify-center font-display font-extrabold text-[22px]">
            {firstName(s.mvp.name).slice(0, 2).toUpperCase()}
          </span>
          <span className="flex flex-col">
            <span className="font-heading font-bold text-[13px] tracking-[0.16em] uppercase">{t.sessions.mvp}</span>
            <span className="font-display font-extrabold text-4xl leading-none uppercase">{firstName(s.mvp.name)}</span>
            <span className="font-body font-semibold text-[13px]">
              {format(t.sessions.mvpSub, { w: s.mvp.wins, d: `${s.mvp.eloDelta >= 0 ? "▲" : "▼"}${Math.abs(s.mvp.eloDelta)}` })}
            </span>
          </span>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {climber && climber.delta > 0 && (
          <Award k={t.sessions.climber} who={firstName(climber.name)} what={`▲${climber.delta} Elo`} tone="text-mint" />
        )}
        {s.mamaKings && (
          <Award
            k={s.mamaKings.names.length > 1 ? t.sessions.mamaKings : t.sessions.mamaKing}
            who={s.mamaKings.names.join(" & ")}
            what={format(s.mamaKings.names.length > 1 ? t.sessions.mamaSub : t.sessions.mamaSubOne, { n: s.mamaKings.count })}
            tone="text-red"
          />
        )}
        {s.ironLiver && (
          <Award k={t.sessions.iron} who={firstName(s.ironLiver.name)} what={format(t.sessions.ironSub, { g: s.ironLiver.games, n: s.games })} tone="text-cream" />
        )}
        {s.duoOfNight && (
          <Award k={t.sessions.duo} who={s.duoOfNight.names} what={format(t.sessions.duoSub, { w: s.duoOfNight.wins, l: s.duoOfNight.losses })} tone="text-gold" />
        )}
      </div>

      <Panel className="flex flex-col gap-1.5">
        <Kicker>{t.sessions.movers}</Kicker>
        {s.movers.map((m) => {
          const w = Math.round((Math.abs(m.delta) / maxAbs) * 100);
          return (
            <div key={m.userId} className="grid grid-cols-[96px_1fr_1fr_44px] items-center h-7">
              <span className="font-body font-semibold text-sm truncate">{firstName(m.name)}</span>
              <div className="flex justify-end pr-0.5">{m.delta < 0 && <div className="h-3 rounded-l-[6px] bg-red" style={{ width: `${w}%` }} />}</div>
              <div className="flex justify-start pl-0.5 border-l border-cream/20">
                {m.delta > 0 && <div className="h-3 rounded-r-[6px] bg-mint" style={{ width: `${w}%` }} />}
              </div>
              <span className={cn("text-right font-heading font-bold text-base", m.delta >= 0 ? "text-mint" : "text-red")}>
                {m.delta >= 0 ? "+" : "−"}
                {Math.abs(m.delta)}
              </span>
            </div>
          );
        })}
      </Panel>

      <section className="flex flex-col gap-1.5">
        <Kicker>{t.sessions.lines}</Kicker>
        {s.lines.map((l) => (
          <Link key={l.userId} href={`/players/${l.userId}`} className="flex items-center gap-3 h-11 px-3 rounded-md bg-surface-deep border border-line text-cream">
            <Avatar name={l.name} size={28} />
            <span className="flex-1 font-body font-semibold text-sm truncate">{firstName(l.name)}</span>
            <span className="font-display font-bold text-base tabular-nums">
              {l.wins}–{l.games - l.wins}
            </span>
            {l.mama > 0 && <span className="font-heading font-bold text-sm text-red w-12 text-right">{l.mama} M</span>}
          </Link>
        ))}
      </section>

      {insights.sessions.length > 1 && (
        <section className="flex flex-col gap-2">
          <Kicker>{t.sessions.others}</Kicker>
          <div className="flex flex-wrap gap-2">
            {insights.sessions.slice(0, 14).map((x) => (
              <Link
                key={x.night}
                href={`/crews/${crewId}/sessions?night=${x.night}`}
                aria-current={x.night === s.night ? "page" : undefined}
                className={cn(
                  "h-9 px-3 rounded-pill flex items-center font-body text-[13px] whitespace-nowrap",
                  x.night === s.night ? "bg-amber text-ink font-bold" : "bg-surface-panel border border-line text-cream/75 font-semibold",
                )}
              >
                {shortFmt.format(asDate(x.night))} · {x.games}
              </Link>
            ))}
          </div>
        </section>
      )}
    </Screen>
  );
}

function Award({ k, who, what, tone }: Readonly<{ k: string; who: string; what: string; tone: string }>) {
  return (
    <div className="px-3 py-3 rounded-[14px] bg-surface-deep border border-line flex flex-col gap-0.5 min-w-0">
      <span className="font-heading font-semibold text-[11px] tracking-[0.14em] uppercase text-cream/55">{k}</span>
      <span className={cn("font-display font-extrabold text-xl leading-[1.1] uppercase truncate", tone)}>{who}</span>
      <span className="font-body text-xs text-cream/75">{what}</span>
    </div>
  );
}
