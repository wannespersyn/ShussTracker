import type { CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";
import { LockIcon } from "@/components/ui/icons";

type BadgeProps = {
  glyph: string;
  name: string;
  sub: string;
  ring?: CapRingColor;
  locked?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

const RING_FILL: Record<CapRingColor, string> = {
  gold: "bg-amber text-ink",
  red: "bg-red text-ink",
  mint: "bg-mint text-ink",
  cream: "bg-surface-raised text-cream",
};

export function Badge({
  glyph,
  name,
  sub,
  ring = "gold",
  locked = false,
  selected = false,
  onClick,
}: BadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border px-1.5 py-3.5 text-center",
        selected ? "bg-surface-raised border-gold/50" : "bg-transparent border-transparent",
      )}
    >
      {locked && <LockIcon className="absolute top-2.5 right-2.5 w-2.75 h-2.75 text-muted" />}
      <div
        className={cn(
          "w-16 h-16 rounded-lg flex items-center justify-center font-display font-extrabold text-[22px]",
          locked ? "bg-surface-deep border border-dashed border-cream/20 text-cream/30" : RING_FILL[ring],
        )}
      >
        {glyph}
      </div>
      <div
        className={cn(
          "font-heading font-bold text-label-sm tracking-kicker uppercase leading-[1.15]",
          locked ? "text-cream/32" : "text-cream",
        )}
      >
        {name}
      </div>
      <div className={cn("font-body text-caption leading-[1.2]", locked ? "text-cream/25" : "text-muted")}>
        {sub}
      </div>
    </button>
  );
}
