import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Shared v2 "scoreboard" building blocks. Server-safe (no hooks). */

export function Screen({ children, className, nav = true }: Readonly<{ children: ReactNode; className?: string; nav?: boolean }>) {
  return (
    <div
      className={cn(
        "min-h-screen bg-surface flex flex-col px-5 pt-4.5 w-full max-w-xl mx-auto",
        !/\bgap-/.test(className ?? "") && "gap-3.5",
        !/\bpb-/.test(className ?? "") && (nav ? "pb-30" : "pb-8"),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Kicker({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <span className={cn("font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted", className)}>{children}</span>
  );
}

export function SectionHead({ title, href, linkLabel }: Readonly<{ title: ReactNode; href?: string; linkLabel?: string }>) {
  return (
    <div className="flex items-center justify-between">
      <Kicker>{title}</Kicker>
      {href && linkLabel && (
        <Link href={href} className="font-body font-semibold text-[13px] text-gold">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function Panel({ children, className, accent = false }: Readonly<{ children: ReactNode; className?: string; accent?: boolean }>) {
  return (
    <section className={cn("rounded-[20px] bg-surface-deep border px-4.5 py-4", accent ? "border-gold/50" : "border-line", className)}>
      {children}
    </section>
  );
}

export function StatGrid({ items, className, size = 26, flat = false }: Readonly<{ items: { label: string; value: ReactNode; tone?: "gold" | "red" | "plain" }[]; className?: string; size?: number; flat?: boolean }>) {
  return (
    <div
      className={cn("grid gap-px rounded-md overflow-hidden bg-line", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <div key={it.label} className={cn("flex flex-col gap-0.5 min-w-0", flat ? "bg-surface-deep px-2.5 py-3" : "bg-surface-raised px-3 py-2.5")}>
          <span className={cn("font-body font-semibold tracking-[0.08em] uppercase text-muted truncate", flat ? "text-[10px]" : "text-[11px]")}>{it.label}</span>
          <span
            className={cn(
              "font-display font-bold leading-none tabular-nums",
              it.tone === "gold" ? "text-gold" : it.tone === "red" ? "text-red" : "text-cream",
            )}
            style={{ fontSize: size }}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** W/L result tiles (last N results, oldest first). */
export function FormStrip({ form, slots = 10, hot = 0 }: Readonly<{ form: ("W" | "L")[]; slots?: number; /** Trailing wins to light up (streak); other wins dim. */ hot?: number }>) {
  const padded: ("W" | "L" | null)[] = [...Array(Math.max(0, slots - form.length)).fill(null), ...form.slice(-slots)];
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }} aria-label={`Last ${form.length}: ${form.join(" ")}`} role="img">
      {padded.map((r, i) => (
        <div
          key={i}
          className={cn(
            "h-7.5 rounded-[6px] flex items-center justify-center font-display font-extrabold text-sm",
            r === "W"
              ? hot && i < slots - hot
                ? "bg-[#5a3a2a] text-cream"
                : "bg-amber text-ink"
              : r === "L"
                ? "bg-chip text-muted"
                : "bg-chip/40",
          )}
        >
          {r ?? ""}
        </div>
      ))}
    </div>
  );
}

/** Tiny 6px W/L dots for list rows. */
export function FormDots({ form }: Readonly<{ form: ("W" | "L")[] }>) {
  if (form.length === 0) return null;
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Last ${form.length}: ${form.join(" ")}`}>
      {form.map((r, i) => (
        <span key={i} className={cn("w-1.5 h-1.5 rounded-pill", r === "W" ? "bg-mint" : "bg-[#4a5150]")} />
      ))}
    </span>
  );
}

type ChipTone = "up" | "down" | "same" | "hot" | "guest" | "info";

export function Chip({ tone, children }: Readonly<{ tone: ChipTone; children: ReactNode }>) {
  return (
    <span
      className={cn(
        "shrink-0 h-4.5 px-1.5 rounded-[5px] inline-flex items-center font-heading font-bold text-[12px] tracking-[0.04em] uppercase whitespace-nowrap",
        tone === "up" && "bg-mint/14 text-mint",
        tone === "down" && "bg-red-pale/15 text-red-pale",
        tone === "same" && "bg-chip text-muted",
        tone === "hot" && "bg-amber text-ink",
        tone === "guest" && "bg-chip text-soft border border-dashed border-cream/30",
        tone === "info" && "bg-chip text-soft",
      )}
    >
      {children}
    </span>
  );
}

export function MoveChip({ move }: Readonly<{ move: number }>) {
  if (move > 0) return <Chip tone="up">▲{move}</Chip>;
  if (move < 0) return <Chip tone="down">▼{Math.abs(move)}</Chip>;
  return <Chip tone="same">—</Chip>;
}

/** Inline-SVG Elo sparkline (no chart lib needed). */
export function Sparkline({ values, width = 320, height = 84, label }: Readonly<{ values: number[]; width?: number; height?: number; label: string }>) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((v - min) / span) * (height - 14);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={label}>
      <path d={`M0 ${height - 1} H${width}`} stroke="var(--color-line)" strokeWidth="1" />
      <path d={d} fill="none" stroke="var(--color-gold)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="4" fill="var(--color-gold)" />
    </svg>
  );
}

export function Avatar({ name, size = 32, fontSize, highlight = false, className }: Readonly<{ name: string; size?: number; fontSize?: number; highlight?: boolean; className?: string }>) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts.length > 1 && /^[a-z]/i.test(parts[1]) ? parts[0][0] + parts[1][0] : name.replace(/\s/g, "").slice(0, 2)).toUpperCase();
  return (
    <span
      className={cn("shrink-0 rounded-pill bg-chip inline-flex items-center justify-center font-body font-bold text-cream", className)}
      style={{ width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.375), boxShadow: highlight ? `inset 0 0 0 2px var(--color-gold)` : undefined }}
    >
      {initials}
    </span>
  );
}

export function IconButton({ href, label, children }: Readonly<{ href: string; label: string; children: ReactNode }>) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="w-11 h-11 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center [&>svg]:w-4.5 [&>svg]:h-4.5"
    >
      {children}
    </Link>
  );
}

/** Underlined text tabs (crew sections). */
export function TextTabs({ tabs }: Readonly<{ tabs: { href: string; label: string; active: boolean }[] }>) {
  return (
    <nav className="flex gap-4.5 border-b border-line" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "h-10 flex items-center font-heading font-bold text-base tracking-[0.08em] uppercase",
            t.active ? "text-cream shadow-[inset_0_-3px_0_var(--color-gold)]" : "text-muted",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Filled segmented links (Players / Duos). */
export function SegmentLinks({ options }: Readonly<{ options: { href: string; label: string; active: boolean }[] }>) {
  return (
    <div className="grid gap-1 p-1 rounded-lg bg-surface-panel border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.active ? "page" : undefined}
          className={cn(
            "h-10.5 rounded-sm flex items-center justify-center font-heading font-bold text-base tracking-[0.08em] uppercase",
            o.active ? "bg-amber text-ink" : "text-muted",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
