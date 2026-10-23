/**
 * Small shared pieces for the beta screens: the BETA pill, a feature tile
 * with its icon, and the switch visual used inside submit buttons.
 * Server-safe (no hooks).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BetaKey } from "@/lib/beta";

export function BetaPill({ children, tone = "gold" }: Readonly<{ children: ReactNode; tone?: "gold" | "ink" }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-5.5 px-2.5 rounded-pill font-heading font-bold text-[11px] leading-none tracking-[0.1em] uppercase whitespace-nowrap",
        tone === "gold" ? "bg-amber text-ink" : "bg-ink text-gold",
      )}
    >
      {children}
    </span>
  );
}

// Inline colours: fixed brand fills that must look the same in light + dark.
const TILE: Record<BetaKey, string> = { wrapped: "#ffb627", start: "#ff6b1a", celebrations: "#c8261a", mat: "#e0a43a" };

export function BetaTile({ feature, size = 48 }: Readonly<{ feature: BetaKey; size?: number }>) {
  return (
    <span className="shrink-0 rounded-[14px] flex items-center justify-center" style={{ width: size, height: size, backgroundColor: TILE[feature] }}>
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke={feature === "celebrations" ? "#fff" : "#111"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {feature === "wrapped" && (
          <>
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M9.5 6.5h5M9 17h6M10 10.5l2 2.5 2-2.5" />
          </>
        )}
        {feature === "start" && (
          <>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3.5" />
          </>
        )}
        {feature === "celebrations" && <path d="M4 18L4 8l4.5 4L12 5l3.5 7L20 8v10z" />}
        {feature === "mat" && (
          <>
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <path d="M12 6.5l2.5 3h-5zM12 17.5l2.5-3h-5z" />
          </>
        )}
      </svg>
    </span>
  );
}

/** Visual only — wrap in a submit button that carries the state. */
export function SwitchVisual({ on, dim = false }: Readonly<{ on: boolean; dim?: boolean }>) {
  return (
    <span className={cn("w-12 h-7 rounded-pill p-0.75 flex shrink-0 transition-colors", on ? "bg-amber justify-end" : "bg-chip justify-start", dim && "opacity-40")}>
      <span className={cn("w-5.5 h-5.5 rounded-pill", on ? "bg-ink" : "bg-muted")} />
    </span>
  );
}

export function BackLink({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <Link href={href} aria-label={label} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-cream/10 text-cream flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}
