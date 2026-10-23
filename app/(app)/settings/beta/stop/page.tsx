/**
 * Leave-the-beta confirmation: lists what disappears, reassures that stats
 * stay, optional reason (saved as beta feedback). `?done=1` shows the
 * confirmation with an undo.
 */
import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getT } from "@/lib/i18n/server";
import { BETA_FEATURES, BETA_LEAVE_REASONS } from "@/lib/beta";
import { Screen } from "@/components/v2";
import { BackLink } from "@/components/beta/BetaUi";
import { leaveBetaAction, rejoinBetaAction } from "../actions";

export default async function BetaStopPage({ searchParams }: Readonly<{ searchParams: Promise<{ done?: string }> }>) {
  await requireSession();
  const [{ done }, t] = await Promise.all([searchParams, getT()]);
  const B = t.beta;

  if (done) {
    return (
      <Screen nav={false} className="gap-5 pb-8">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="w-18 h-18 rounded-pill bg-surface-raised border border-line-strong flex items-center justify-center">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1 className="font-display font-extrabold text-[42px] leading-[0.9] uppercase">{B.stoppedTitle}</h1>
          <p className="max-w-72 font-body text-[15px] leading-[1.45] text-soft">{B.stoppedBody}</p>
        </div>
        <Link href="/settings" className="h-13.5 rounded-pill bg-cream text-surface font-body font-bold text-base flex items-center justify-center">
          {B.toSettings}
        </Link>
        <form action={rejoinBetaAction}>
          <button type="submit" className="w-full min-h-11 font-body font-bold text-sm text-muted">
            {B.undo}
          </button>
        </form>
      </Screen>
    );
  }

  return (
    <Screen nav={false} className="gap-5 pb-8">
      <header className="flex items-center h-11">
        <BackLink href="/settings/beta" label={t.common.back} />
      </header>
      <h1 className="font-display font-extrabold text-[44px] leading-[0.9] uppercase">{B.stopTitle}</h1>
      <p className="font-body text-sm leading-[1.45] text-soft">{B.stopBody}</p>
      <ul className="flex flex-col gap-1.5 font-body font-bold text-sm text-cream">
        {BETA_FEATURES.map((f) => (
          <li key={f.key} className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-pill bg-red" aria-hidden="true" />
            {B.features[f.key].title}
          </li>
        ))}
      </ul>
      <p className="rounded-[12px] bg-mint/15 border border-mint/40 text-mint px-3 py-2.5 font-body font-semibold text-[13px] leading-[1.4]">{B.stopSafe}</p>

      <form action={leaveBetaAction} className="mt-auto flex flex-col gap-3">
        <fieldset>
          <legend className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted mb-2">{B.stopWhy}</legend>
          <div className="flex flex-wrap gap-1.5">
            {BETA_LEAVE_REASONS.map((r) => (
              <label
                key={r}
                className="min-h-9.5 px-3.5 rounded-pill border-2 border-line-strong flex items-center font-body font-bold text-[13px] text-cream cursor-pointer has-checked:bg-cream has-checked:border-cream has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-gold"
              >
                <input type="radio" name="reason" value={r} className="sr-only" />
                {B.reasons[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="h-14 rounded-pill bg-red text-ink font-body font-bold text-base">
          {B.stopCta}
        </button>
        <Link href="/settings/beta" className="min-h-11 flex items-center justify-center font-body font-bold text-[15px] text-cream">
          {B.stopStay}
        </Link>
      </form>
    </Screen>
  );
}
