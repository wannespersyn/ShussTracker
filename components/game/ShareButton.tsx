"use client";

import { useState } from "react";

/** Native share sheet where available, otherwise copies the link. */
export function ShareButton({
  label,
  title,
  copiedLabel,
  cta,
  url,
  className,
}: Readonly<{
  label: string;
  title: string;
  copiedLabel: string;
  /** Render as a full-width amber button with this text. */
  cta?: string;
  /** Defaults to the current page. */
  url?: string;
  /** Overrides the CTA button styling. */
  className?: string;
}>) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = url ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* dismissed */
    }
  }

  if (cta) {
    return (
      <button
        type="button"
        onClick={share}
        className={
          className ??
          "w-full h-14 shrink-0 rounded-lg bg-amber text-ink flex items-center justify-center font-heading font-extrabold text-[19px] tracking-[0.06em] uppercase"
        }
      >
        {copied ? copiedLabel : cta}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? copiedLabel : label}
      className="w-11 h-11 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
        </svg>
      )}
    </button>
  );
}
