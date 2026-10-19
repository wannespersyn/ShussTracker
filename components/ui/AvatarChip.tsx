import type { CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

type AvatarChipProps = {
  initials: string;
  ring?: CapRingColor;
  /** Outer diameter in px. */
  size?: number;
  /** Kept for API compatibility with v1 call sites; v2 is flat. */
  elevated?: boolean;
  className?: string;
};

/** v2 scoreboard avatar: flat circle with initials and a thin colored ring
 * (amber = you / highlighted, red, mint, neutral). Replaces the v1 bottle-cap. */
const RING: Record<CapRingColor, string> = {
  gold: "var(--color-gold)",
  red: "var(--color-red)",
  cream: "color-mix(in oklab, var(--color-cream) 22%, transparent)",
  mint: "var(--color-mint)",
};

export function AvatarChip({ initials, ring = "cream", size = 40, className }: Readonly<AvatarChipProps>) {
  const fontSize = Math.max(10, Math.round(size * 0.34));
  const border = Math.max(1.5, Math.round(size * 0.05));

  return (
    <div
      className={cn("shrink-0 rounded-pill bg-surface-raised flex items-center justify-center font-heading font-bold text-cream", className)}
      style={{ width: size, height: size, fontSize, boxShadow: `inset 0 0 0 ${border}px ${RING[ring]}` }}
    >
      {initials}
    </div>
  );
}
