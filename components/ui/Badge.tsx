import { capCrownClipPath, capRingGradient, capRingPairs, type CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

type BadgeProps = {
  glyph: string;
  name: string;
  sub: string;
  ring?: CapRingColor;
  locked?: boolean;
  selected?: boolean;
  onClick?: () => void;
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
        "flex flex-col items-center gap-2 rounded-xl border px-1.5 py-3.5 text-center",
        selected ? "bg-gold/10 border-gold/30" : "bg-transparent border-transparent",
      )}
    >
      <div
        className="relative"
        style={{
          width: 74,
          height: 74,
          background: locked ? "rgba(246,239,221,0.12)" : capRingGradient(ring),
          clipPath: capCrownClipPath,
        }}
      >
        {!locked && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill"
            style={{ width: 60, height: 60, background: capRingPairs[ring].light }}
          />
        )}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill flex items-center justify-center font-display text-[19px]",
            locked ? "bg-surface/60 text-cream/30" : "bg-surface",
          )}
          style={{ width: 54, height: 54, color: locked ? undefined : capRingPairs[ring].light }}
        >
          {glyph}
        </div>
      </div>
      <div
        className={cn(
          "font-heading font-bold text-label-sm tracking-kicker uppercase leading-[1.15]",
          locked ? "text-cream/32" : "text-cream",
        )}
      >
        {name}
      </div>
      <div className={cn("font-body text-caption leading-[1.2]", locked ? "text-cream/25" : "text-cream/55")}>
        {sub}
      </div>
    </button>
  );
}
