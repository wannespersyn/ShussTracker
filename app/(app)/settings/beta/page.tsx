/**
 * Settings › Beta. Not joined yet → the welcome sheet with "Yes, I'm in".
 * Joined → master switch, one card per beta feature (own switch + link to
 * its explainer), feedback and leave links.
 */
import Link from "next/link";
import { requireSession } from "@/lib/db/authz";
import { getBetaState } from "@/lib/db/beta";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { BETA_FEATURES } from "@/lib/beta";
import { cn } from "@/lib/cn";
import { Kicker, Screen } from "@/components/v2";
import { BackLink, BetaPill, BetaTile, SwitchVisual } from "@/components/beta/BetaUi";
import { joinBetaAction, toggleBetaFeatureAction } from "./actions";

export default async function BetaPage() {
  const session = await requireSession();
  const [t, state] = await Promise.all([getT(), getBetaState(session.user.id)]);
  const B = t.beta;

  if (!state.optIn) {
    const steps = [
      [B.welcome1Title, B.welcome1Body],
      [B.welcome2Title, B.welcome2Body],
      [B.welcome3Title, B.welcome3Body],
    ];
    return (
      <Screen nav={false} className="gap-5 pb-8">
        <header className="flex items-center gap-3 h-11">
          <BackLink href="/settings" label={t.common.back} />
        </header>
        <section className="rounded-[28px] bg-amber px-6 pt-7 pb-5 flex flex-col" style={{ color: "#111" }}>
          <span className="w-16 h-16 rounded-[18px] bg-ink flex items-center justify-center">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3M7.5 14h9" />
            </svg>
          </span>
          <h1 className="mt-5 font-display font-extrabold text-[46px] leading-[0.95] uppercase whitespace-pre-line">{B.welcomeTitle}</h1>
          <p className="mt-3 font-body text-[15px] leading-[1.5]">{B.welcomeSub}</p>
          <ol className="mt-6 flex flex-col gap-4.5">
            {steps.map(([title, body], i) => (
              <li key={title} className="flex gap-3.5 items-start">
                <span className="w-8 h-8 shrink-0 rounded-pill flex items-center justify-center font-display font-extrabold text-base" style={{ backgroundColor: "#111", color: "#ffb627" }}>
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5 pt-0.5">
                  <span className="font-body font-bold text-[15px] leading-tight">{title}</span>
                  <span className="font-body text-[13px] leading-[1.45]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-[16px] px-4 py-3.5 font-body text-[13px] leading-[1.5]" style={{ backgroundColor: "rgba(17,17,17,0.08)" }}>
            {B.welcomeNote}
          </p>
          <form action={joinBetaAction} className="mt-6">
            <button type="submit" className="w-full h-14 rounded-pill font-body font-bold text-[17px]" style={{ backgroundColor: "#111", color: "#fff" }}>
              {B.welcomeYes}
            </button>
          </form>
          <Link href="/settings" className="mt-2 min-h-11 flex items-center justify-center font-body font-bold text-[15px]" style={{ color: "#111" }}>
            {B.welcomeNo}
          </Link>
        </section>
      </Screen>
    );
  }

  const active = BETA_FEATURES.filter((f) => !state.disabled.includes(f.key)).length;

  return (
    <Screen nav={false} className="gap-5 pb-8">
      <header className="flex items-center justify-between h-11">
        <BackLink href="/settings" label={t.common.back} />
        <span className="font-body text-xs text-muted">{B.version}</span>
      </header>
      <div className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 font-display font-extrabold text-[44px] leading-none uppercase">
          Shussapp
          <span className="px-2.5 pt-1.5 pb-1 rounded-[10px] bg-amber text-[28px] leading-none" style={{ color: "#111" }}>
            {B.pill}
          </span>
        </h1>
        <p className="font-body text-[15px] leading-[1.5] text-soft">{B.intro}</p>
      </div>

      <Link href="/settings/beta/stop" role="switch" aria-checked="true" className="w-full flex items-center gap-4 px-4.5 py-4 rounded-[18px] border-2 border-gold text-cream">
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="font-body font-bold text-base">{B.join}</span>
          <span className="font-body text-xs text-muted">{B.joinOn}</span>
        </span>
        <SwitchVisual on />
      </Link>

      <div className="flex items-baseline justify-between mt-2">
        <Kicker>{B.inThisBeta}</Kicker>
        <span className="font-body text-xs text-muted">{format(B.activeCount, { n: active, total: BETA_FEATURES.length })}</span>
      </div>

      <div className="-mt-1 flex flex-col gap-3">
        {BETA_FEATURES.map((f) => {
          const copy = B.features[f.key];
          const on = !state.disabled.includes(f.key);
          return (
            <section key={f.key} className="rounded-[20px] bg-surface-deep border border-line px-4 pt-4 pb-3">
              <div className="flex gap-3.5 items-start">
                <BetaTile feature={f.key} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-body font-bold text-base leading-tight text-cream">{copy.title}</span>
                    <BetaPill>{B.newPill}</BetaPill>
                  </div>
                  <p className="mt-1.5 font-body text-[13px] leading-[1.5] text-muted">{copy.desc}</p>
                </div>
                <form action={toggleBetaFeatureAction}>
                  <input type="hidden" name="key" value={f.key} />
                  <input type="hidden" name="on" value={on ? "0" : "1"} />
                  <button type="submit" role="switch" aria-checked={on} aria-label={format(B.toggleLabel, { feature: copy.title })} className="min-h-11 flex items-center">
                    <SwitchVisual on={on} />
                  </button>
                </form>
              </div>
              <div className="mt-3.5 pt-3 border-t border-line flex items-center justify-between gap-3">
                <span className="font-body text-xs text-muted">{copy.where}</span>
                <Link href={`/settings/beta/${f.key}`} className={cn("min-h-8 inline-flex items-center gap-1 font-body font-bold text-[13px] text-gold")}>
                  {B.explainFeedback} ›
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      <Link href="/settings/beta/feedback" className="mt-3 h-14 rounded-pill bg-cream text-surface font-body font-bold text-base flex items-center justify-center gap-2">
        {B.feedbackCta}
      </Link>
      <Link href="/settings/beta/stop" className="min-h-10 flex items-center justify-center font-body font-bold text-[13px] text-muted">
        {B.stopLink}
      </Link>
    </Screen>
  );
}
