import { capFaceGradient, capInkColor, capRingGradient, type CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

type AvatarChipProps = {
  initials: string;
  ring?: CapRingColor;
  /** Outer diameter in px. */
  size?: number;
  /** Adds the ambient drop shadow used for hero-sized chips (home header,
   * onboarding, leaderboard "king of the mat" capsule) — small list-row
   * chips skip it. */
  elevated?: boolean;
  className?: string;
};

/** Bottle-cap avatar: a sunburst ring around a glossy radial "face," with
 * initials set directly on the face in a dark ink tone — no separate
 * neutral center plate. */
export function AvatarChip({ initials, ring = "gold", size = 40, elevated = false, className }: AvatarChipProps) {
  const inset = Math.max(2, Math.round(size * 0.09));
  const fontSize = Math.max(10, Math.round(size * 0.32));

  return (
    <div
      className={cn("relative shrink-0 rounded-pill", className)}
      style={{
        width: size,
        height: size,
        background: capRingGradient(ring),
        boxShadow: `inset 0 0 0 1px rgba(0,0,0,.5), inset 0 -2px 3px rgba(0,0,0,.35), inset 0 2px 3px rgba(255,255,255,.12)${elevated ? ", 0 5px 16px rgba(0,0,0,.5)" : ""}`,
      }}
    >
      <div
        className="absolute rounded-pill flex items-center justify-center font-heading font-bold"
        style={{
          inset,
          background: capFaceGradient(ring),
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.45), inset 0 -1px 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.35)",
          fontSize,
          color: capInkColor(ring),
        }}
      >
        {initials}
      </div>
    </div>
  );
}
