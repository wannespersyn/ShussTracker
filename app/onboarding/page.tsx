"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";
import { setLocaleAction } from "@/app/(app)/settings/preferences-actions";

/** v2 sign-in: one screen — language chips, a big condensed headline and
 * the sign-in options. (The v1 three-slide intro is gone: the app explains
 * itself after the first logged game.) */
export default function OnboardingPage() {
  const { t, locale } = useT();
  const [pending, start] = useTransition();

  function pickLocale(l: string) {
    const fd = new FormData();
    fd.append("locale", l);
    start(() => setLocaleAction(fd));
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col px-6 pt-4.5 pb-8 w-full max-w-md mx-auto">
      <div role="group" aria-label={t.settings.language} className="flex justify-end gap-1.5">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            disabled={pending}
            onClick={() => pickLocale(l)}
            aria-pressed={l === locale}
            className={cn(
              "w-11 h-9 rounded-sm font-heading font-bold text-[15px] uppercase",
              l === locale ? "bg-amber text-ink" : "bg-surface-panel border border-line text-cream/55",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5.5 py-10">
        <svg width="92" height="92" viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeDasharray="3 2.2" />
          <circle cx="15" cy="15" r="8" fill="var(--color-gold)" />
        </svg>
        <h1 className="font-display font-extrabold text-[64px] leading-[0.92] uppercase whitespace-pre-line">{t.onboarding.headline}</h1>
        <p className="font-body text-[17px] leading-[1.45] text-cream/75">{t.onboarding.sub}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/home" })}
          className="h-13.5 rounded-[14px] bg-cream text-surface flex items-center justify-center gap-2.5 font-body font-bold text-base"
        >
          <span aria-hidden="true" className="w-6 h-6 rounded-pill bg-surface text-cream flex items-center justify-center font-heading font-extrabold text-[15px]">G</span>
          {t.onboarding.google}
        </button>
        <Link
          href="/onboarding/join-crew"
          className="h-13.5 rounded-[14px] bg-surface-panel border border-line text-cream flex items-center justify-center font-body font-bold text-base"
        >
          {t.onboarding.code}
        </Link>
        <span className="text-center font-body text-xs text-cream/55 leading-[1.5] mt-1">{t.onboarding.legal}</span>
      </div>
    </div>
  );
}
