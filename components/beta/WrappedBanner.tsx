/**
 * Beta banner/card that points to Shussapp Wrapped. `variant="feed"` can be
 * hidden per device (remembered in localStorage); `variant="profile"` is a
 * permanent card on your own profile.
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

const HIDE_KEY = "shuss:wrapped-banner-hidden";

export function WrappedBanner({ variant, season }: Readonly<{ variant: "feed" | "profile"; season: string }>) {
  const { t } = useT();
  const W = t.beta.wrapped;
  const [hidden, setHidden] = useState(variant === "feed");

  useEffect(() => {
    if (variant !== "feed") return;
    let stored = false;
    try {
      stored = localStorage.getItem(HIDE_KEY) === season;
    } catch {
      // storage blocked: just show it
    }
    const id = setTimeout(() => setHidden(stored), 0);
    return () => clearTimeout(id);
  }, [variant, season]);

  if (hidden) return null;

  function hide() {
    try {
      localStorage.setItem(HIDE_KEY, season);
    } catch {
      // ignore
    }
    setHidden(true);
  }

  return (
    <section className="relative rounded-[20px] p-4.5 overflow-hidden" style={{ backgroundColor: "#ffb627", color: "#111" }}>
      {variant === "feed" && (
        <button type="button" onClick={hide} aria-label={W.hide} className="absolute right-1.5 top-1.5 w-11 h-11 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      <span className="inline-flex items-center h-5.5 px-2.5 rounded-pill font-heading font-bold text-[11px] leading-none tracking-[0.12em]" style={{ backgroundColor: "#111", color: "#ffb627" }}>
        {t.beta.pill}
      </span>
      <h2 className="mt-3 font-display font-extrabold text-[38px] leading-[0.92] uppercase max-w-[260px]">{W.bannerTitle}</h2>
      <p className="mt-2 font-body text-sm leading-[1.45] max-w-[280px]">{variant === "feed" ? W.bannerBody : format(W.cardSub, { season })}</p>
      <Link href="/wrapped" className="mt-4 inline-flex items-center gap-2 h-11 px-4.5 rounded-pill font-body font-bold text-[15px]" style={{ backgroundColor: "#111", color: "#fff" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 4.5v15l12-7.5z" />
        </svg>
        {W.bannerCta}
      </Link>
    </section>
  );
}
