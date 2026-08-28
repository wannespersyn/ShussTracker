"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A small "i" icon button that reveals a centered modal popover with info
 * text — for inline help that would otherwise clutter a settings row.
 * Closes on backdrop click, Escape, or a second click. */
export function InfoButton({
  children,
  ariaLabel = "More info",
  className,
}: Readonly<{
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-pill font-heading font-bold text-[11px] leading-none shrink-0 transition-colors",
          open ? "bg-gold text-ink" : "bg-cream/14 text-cream/55 hover:bg-cream/20",
          className,
        )}
      >
        i
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
          />
          <div
            role="tooltip"
            className="relative w-full max-w-sm rounded-lg bg-surface-panel border border-cream/10 shadow-elevation-xl p-4 font-body text-body-sm text-cream/70"
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}
