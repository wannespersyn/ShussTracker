/**
 * CrewKickstart
 *
 * Checklist on a new crew's page until it has played a few games: pick your
 * game (owner), get at least 4 players in (invite or add guests), log the
 * first game, play 3 games for a real ranking. Many crews stopped after
 * creating or after 3 games — this gets the first evening going.
 *
 * Exports: CrewKickstart, KICKSTART_GAMES
 * Notes: server component; links only, no data of its own.
 */
import Link from "next/link";
import { format, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/** The card hides once a crew has played this many games. */
export const KICKSTART_GAMES = 3;

type Step = { done: boolean; title: string; sub: string; href?: string; cta?: string };

export function CrewKickstart({
  t,
  crewId,
  isOwner,
  rulesSet,
  players,
  games,
}: Readonly<{ t: Dictionary; crewId: string; isOwner: boolean; rulesSet: boolean; players: number; games: number }>) {
  const K = t.kickstart;
  const steps: Step[] = [
    ...(isOwner ? [{ done: rulesSet, title: K.rules, sub: K.rulesSub, href: `/crews/${crewId}/manage`, cta: K.rulesCta }] : []),
    { done: players >= 4, title: K.invite, sub: format(K.inviteSub, { n: players }), href: isOwner ? `/crews/${crewId}/manage` : undefined, cta: isOwner ? K.inviteCta : undefined },
    { done: games >= 1, title: K.first, sub: K.firstSub, href: `/log?crewId=${crewId}`, cta: K.firstCta },
    { done: games >= KICKSTART_GAMES, title: K.three, sub: format(K.threeSub, { n: games, total: KICKSTART_GAMES }) },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="kickstart" className="flex flex-col gap-2.5 p-3.5 rounded-[18px] bg-surface-raised border border-gold/35">
      <h2 id="kickstart" className="font-display font-extrabold text-xl uppercase tracking-[0.04em]">
        {K.title}
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.title} className={cn("flex items-start gap-3", s.done && "opacity-55")}>
            <span
              aria-hidden="true"
              className={cn(
                "w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-heading font-bold text-[13px]",
                s.done ? "bg-mint text-ink" : i === next ? "bg-amber text-ink" : "bg-chip text-muted",
              )}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className={cn("font-body font-semibold text-[15px]", s.done && "line-through")}>
                {s.title}
                <span className="sr-only">{s.done ? ` (${K.done})` : ""}</span>
              </span>
              <span className="font-body text-xs text-muted leading-snug">{s.sub}</span>
            </span>
            {!s.done && s.href && s.cta && (
              <Link
                href={s.href}
                className={cn(
                  "shrink-0 h-8 px-3 rounded-sm font-body font-bold text-xs flex items-center",
                  i === next ? "bg-amber text-ink" : "bg-surface-panel border border-line-strong text-cream",
                )}
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
