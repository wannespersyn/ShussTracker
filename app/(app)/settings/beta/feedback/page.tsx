/**
 * Beta feedback sheet: 1–4 score, quick tags, optional text. Works without
 * client JS (radio/checkbox inputs styled with `has-checked`). Linked from
 * the hub (general), each explainer, and later from a prompt after first use.
 */
import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { BETA_TAGS, isBetaKey } from "@/lib/beta";
import { Screen } from "@/components/v2";
import { BackLink, BetaPill } from "@/components/beta/BetaUi";
import { betaFeedbackAction } from "../actions";

export default async function BetaFeedbackPage({ searchParams }: Readonly<{ searchParams: Promise<{ feature?: string; sent?: string }> }>) {
  await requireSession();
  const [{ feature: raw, sent }, t] = await Promise.all([searchParams, getT()]);
  const B = t.beta;
  const feature = isBetaKey(raw) ? raw : null;
  const name = feature ? B.features[feature].title : B.general;
  const back = feature ? `/settings/beta/${feature}` : "/settings/beta";

  if (sent) {
    return (
      <Screen nav={false} className="gap-5 pb-8 items-stretch">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="w-19 h-19 rounded-pill bg-amber flex items-center justify-center">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1 className="font-display font-extrabold text-[48px] leading-[0.9] uppercase">{B.fbThanksTitle}</h1>
          <p className="max-w-72 font-body text-[15px] leading-[1.45] text-soft">{B.fbThanksBody}</p>
        </div>
        <Link href="/settings/beta" className="h-14 rounded-pill bg-amber text-ink font-body font-bold text-base flex items-center justify-center">
          {B.backToBeta}
        </Link>
      </Screen>
    );
  }

  const rates = [B.rate1, B.rate2, B.rate3, B.rate4];

  return (
    <Screen nav={false} className="gap-5 pb-8">
      <header className="flex items-center justify-between h-11">
        <BackLink href={back} label={t.common.back} />
        <BetaPill tone="ink">{format(B.fbKicker, { feature: name })}</BetaPill>
      </header>
      <h1 className="font-display font-extrabold text-[40px] leading-[0.92] uppercase">{format(B.fbTitle, { feature: name })}</h1>

      <form action={betaFeedbackAction} className="flex flex-col gap-4">
        <input type="hidden" name="feature" value={feature ?? ""} />
        <fieldset>
          <legend className="sr-only">{B.fbRating}</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {rates.map((label, i) => (
              <label
                key={label}
                className="h-16 rounded-[14px] border-2 border-line-strong bg-surface-deep flex flex-col items-center justify-center gap-0.5 cursor-pointer text-cream has-checked:bg-amber has-checked:border-amber has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-gold"
              >
                <input type="radio" name="rating" value={i + 1} className="sr-only" />
                <span className="font-display font-extrabold text-2xl leading-none">{i + 1}</span>
                <span className="font-body font-bold text-[11px]">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted mb-2">{B.fbTags}</legend>
          <div className="flex flex-wrap gap-1.5">
            {BETA_TAGS.map((tag) => (
              <label
                key={tag}
                className="min-h-9.5 px-3.5 rounded-pill border-2 border-line-strong flex items-center font-body font-bold text-[13px] text-cream cursor-pointer has-checked:bg-cream has-checked:border-cream has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-gold"
              >
                <input type="checkbox" name="tag" value={tag} className="sr-only" />
                {B.tags[tag]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="beta-fb" className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">
            {B.fbText}
          </label>
          <textarea
            id="beta-fb"
            name="text"
            rows={3}
            maxLength={1000}
            placeholder={B.fbPlaceholder}
            className="rounded-[14px] bg-surface-deep border border-line-strong px-3.5 py-3 font-body text-sm text-cream placeholder:text-muted outline-none resize-none"
          />
        </div>

        <button type="submit" className="h-14 rounded-pill bg-amber text-ink font-body font-bold text-base">
          {B.fbSend}
        </button>
        <p className="-mt-2 text-center font-body text-xs text-muted">{B.fbNote}</p>
      </form>
    </Screen>
  );
}
