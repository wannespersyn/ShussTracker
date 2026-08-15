import { capFaceGradient, capInkColor, capRingGradient, type CapRingColor } from "@/lib/theme/tokens";
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
        selected ? "bg-gold/10 border-gold/30" : "bg-transparent border-transparent",
      )}
    >
      {locked && <LockIcon className="absolute top-2.5 right-2.5 w-2.75 h-2.75 text-cream/45" />}
      <div
        className="relative rounded-pill"
        style={{
          width: 74,
          height: 74,
          background: locked ? "rgba(239,231,214,0.1)" : capRingGradient(ring),
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.5), inset 0 -2px 3px rgba(0,0,0,.35), inset 0 2px 3px rgba(255,255,255,.12)",
        }}
      >
        <div
          className={cn(
            "absolute inset-2 rounded-pill flex items-center justify-center font-display text-[19px]",
            locked && "bg-surface/60 text-cream/30",
          )}
          style={
            locked
              ? undefined
              : {
                  background: capFaceGradient(ring),
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,.45), inset 0 -1px 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.35)",
                  color: capInkColor(ring),
                }
          }
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
