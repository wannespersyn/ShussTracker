import { capCrownClipPath, capRingGradient, capRingPairs, type CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

type AvatarChipProps = {
  initials: string;
  ring?: CapRingColor;
  /** Outer diameter in px. */
  size?: number;
  /** Inner-circle treatment — "dark" (ink bg/cream text) is the common
   * case across leaderboards/replay/H2H; "light" (cream bg/ink text) is
   * used for the home-header hero chip. */
  variant?: "dark" | "light";
  className?: string;
};

export function AvatarChip({
  initials,
  ring = "gold",
  size = 40,
  variant = "dark",
  className,
}: AvatarChipProps) {
  const bezelSize = Math.round(size * 0.76);
  const innerSize = Math.round(size * 0.64);
  const fontSize = Math.max(10, Math.round(size * 0.32));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size, background: capRingGradient(ring), clipPath: capCrownClipPath }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill"
        style={{ width: bezelSize, height: bezelSize, background: capRingPairs[ring].light }}
      />
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill flex items-center justify-center font-display",
          variant === "dark" ? "bg-surface text-cream" : "bg-cream text-surface",
        )}
        style={{ width: innerSize, height: innerSize, fontSize }}
      >
        {initials}
      </div>
    </div>
  );
}
