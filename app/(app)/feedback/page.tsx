import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getIdeas } from "@/lib/db/feedback";
import { getUserCrews } from "@/lib/db/crew-insights";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { Kicker, Screen } from "@/components/v2";
import { submitFeedbackAction, toggleVoteAction } from "./actions";

const TYPES = ["bug", "idea", "other"] as const;
const ICONS = {
  bug: "M8 8a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM4 12h4M16 12h4M5 6l3 2M19 6l-3 2M5 19l3-2M19 19l-3-2",
  idea: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
  other: "M4 5h16v11H9l-5 4z",
};

export default async function FeedbackPage({ searchParams }: Readonly<{ searchParams: Promise<{ type?: string; sent?: string }> }>) {
  const session = await requireSession();
  const [{ type: typeParam, sent }, ideas, crews, t] = await Promise.all([
    searchParams,
    getIdeas(session.user.id),
    getUserCrews(session.user.id),
    getT(),
  ]);
  const type = (TYPES as readonly string[]).includes(typeParam ?? "") ? (typeParam as (typeof TYPES)[number]) : "idea";
  const copy = { bug: t.feedback.bugPrompt, idea: t.feedback.ideaPrompt, other: t.feedback.otherPrompt }[type];
  const placeholder = { bug: t.feedback.bugPlaceholder, idea: t.feedback.ideaPlaceholder, other: t.feedback.otherPlaceholder }[type];
  const statusLabel: Record<string, string> = {
    new: t.feedback.statusNew,
    under_review: t.feedback.statusReview,
    planned: t.feedback.statusPlanned,
    in_progress: t.feedback.statusProgress,
  };

  return (
    <Screen>
      <header className="flex items-center gap-3 h-11">
        <Link
          href="/settings"
          aria-label={t.common.back}
          className="w-11 h-11 rounded-pill bg-surface-panel border border-line text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="font-display font-extrabold text-[26px] uppercase tracking-[0.04em]">{t.feedback.title}</h1>
      </header>

      {sent && (
        <div className="rounded-[14px] bg-mint/15 border border-mint/40 text-mint px-3.5 py-2.5 font-body font-semibold text-sm">{t.feedback.thanks}</div>
      )}

      <nav className="grid grid-cols-3 gap-1.5" aria-label={t.feedback.type}>
        {TYPES.map((k) => (
          <Link
            key={k}
            href={`/feedback?type=${k}`}
            aria-current={k === type ? "page" : undefined}
            className={cn(
              "h-16 rounded-[14px] flex flex-col items-center justify-center gap-1 font-heading font-bold text-sm tracking-[0.08em] uppercase",
              k === type ? "bg-amber text-ink" : "bg-surface-deep border border-line text-cream/55",
            )}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d={ICONS[k]} />
            </svg>
            {{ bug: t.feedback.bug, idea: t.feedback.idea, other: t.feedback.other }[k]}
          </Link>
        ))}
      </nav>

      <form action={submitFeedbackAction} className="flex flex-col gap-2.5">
        <input type="hidden" name="type" value={type} />
        {crews[0] && <input type="hidden" name="groupId" value={crews[0].id} />}
        <label htmlFor="fb" className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">
          {copy}
        </label>
        <textarea
          id="fb"
          name="text"
          required
          minLength={3}
          maxLength={1000}
          rows={4}
          placeholder={placeholder}
          className="rounded-[14px] bg-surface-panel border border-line px-3.5 py-3 font-body text-[15px] text-cream placeholder:text-cream/40 outline-none focus:border-gold/60 resize-none"
        />
        <button type="submit" className="h-12 rounded-md bg-amber text-ink font-heading font-extrabold text-[17px] tracking-[0.06em] uppercase">
          {t.feedback.send}
        </button>
      </form>

      <section className="flex flex-col gap-2 mt-1" aria-label={t.feedback.mostWanted}>
        <div className="flex justify-between items-baseline">
          <Kicker>{t.feedback.mostWanted}</Kicker>
          <span className="font-body text-xs text-cream/55">{t.feedback.topBuilt}</span>
        </div>
        {ideas.length === 0 && <p className="font-body text-sm text-cream/55">{t.feedback.noIdeas}</p>}
        {ideas.map((i) => (
          <div key={i.id} className="flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-[14px] bg-surface-deep border border-line">
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="font-body font-semibold text-sm text-pretty">{i.text}</span>
              <span
                className={cn(
                  "font-heading font-bold text-xs tracking-[0.1em] uppercase",
                  i.status === "in_progress" ? "text-mint" : i.status === "planned" ? "text-gold" : "text-cream/55",
                )}
              >
                {statusLabel[i.status]}
              </span>
            </span>
            <form action={toggleVoteAction.bind(null, i.id)}>
              <button
                type="submit"
                aria-pressed={i.votedByMe}
                aria-label={t.feedback.upvote}
                className={cn(
                  "w-14 h-12 rounded-md flex flex-col items-center justify-center",
                  i.votedByMe ? "bg-amber text-ink" : "bg-surface-raised border border-line text-cream/75",
                )}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <path d="M6 15l6-6 6 6" />
                </svg>
                <span className="font-display font-extrabold text-base leading-none">{i.votes}</span>
              </button>
            </form>
          </div>
        ))}
      </section>
    </Screen>
  );
}
