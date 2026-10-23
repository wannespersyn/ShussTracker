/**
 * Explainer for one beta feature: what it is, where you find it, notes,
 * and a quick thumbs up/down (stored as beta feedback) with a link to the
 * full feedback sheet.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { isBetaKey } from "@/lib/beta";
import { cn } from "@/lib/cn";
import { Screen } from "@/components/v2";
import { BackLink, BetaPill, BetaTile } from "@/components/beta/BetaUi";
import { quickRateAction } from "../actions";

export default async function BetaFeaturePage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ feature: string }>; searchParams: Promise<{ rated?: string }> }>) {
  await requireSession();
  const [{ feature }, { rated }, t] = await Promise.all([params, searchParams, getT()]);
  if (!isBetaKey(feature)) notFound();
  const B = t.beta;
  const copy = B.features[feature];
  const notes = copy.notes.split("\n");

  return (
    <Screen nav={false} className="gap-5 pb-8">
      <header className="flex items-center justify-between h-11">
        <BackLink href="/settings/beta" label={t.common.back} />
        <BetaPill>{B.pill}</BetaPill>
      </header>

      <div className="flex items-center gap-3.5">
        <BetaTile feature={feature} size={64} />
        <h1 className="font-display font-extrabold text-[40px] leading-[0.9] uppercase">{copy.title}</h1>
      </div>
      <p className="font-body text-sm leading-[1.45] text-soft">{copy.about}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-surface-deep border border-line px-3 py-3">
          <div className="font-heading font-bold text-[11px] tracking-[0.12em] uppercase text-muted">{B.where}</div>
          <div className="mt-1 font-body font-bold text-sm text-cream">{copy.where}</div>
        </div>
        <div className="rounded-[14px] bg-surface-deep border border-line px-3 py-3">
          <div className="font-heading font-bold text-[11px] tracking-[0.12em] uppercase text-muted">{B.forWho}</div>
          <div className="mt-1 font-body font-bold text-sm text-cream">{copy.forWho}</div>
        </div>
      </div>

      <section className="rounded-[14px] border border-dashed border-line-strong px-3.5 py-3">
        <div className="font-heading font-bold text-[11px] tracking-[0.12em] uppercase text-gold">{copy.notesTitle}</div>
        <ul className="mt-1.5 flex flex-col gap-1 font-body text-[13px] leading-[1.5] text-soft">
          {notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      </section>

      <section className="mt-auto rounded-[18px] bg-surface-deep border border-line p-3.5">
        <div className="font-body font-bold text-[15px] text-cream">{format(B.rateQuestion, { feature: copy.title })}</div>
        <form action={quickRateAction} className="mt-2.5 grid grid-cols-2 gap-2">
          <input type="hidden" name="key" value={feature} />
          {(
            [
              ["up", B.rateUp, "M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7", "bg-mint border-mint"],
              ["down", B.rateDown, "M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17", "bg-red-pale border-red-pale"],
            ] as const
          ).map(([vote, label, d, onCls]) => (
            <button
              key={vote}
              type="submit"
              name="vote"
              value={vote}
              aria-pressed={rated === vote}
              className={cn(
                "h-12 rounded-[14px] border-2 flex items-center justify-center gap-2 font-body font-bold text-[15px]",
                rated === vote ? cn(onCls, "text-ink") : "border-line-strong text-cream",
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={d} />
              </svg>
              {label}
            </button>
          ))}
        </form>
        <Link href={`/settings/beta/feedback?feature=${feature}`} className="mt-2.5 inline-flex min-h-8 items-center font-body font-bold text-[13px] text-gold">
          {rated ? B.rateThanks : B.writeMore}
        </Link>
      </section>
    </Screen>
  );
}
