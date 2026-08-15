import Link from "next/link";
import { AvatarChip } from "@/components/ui/AvatarChip";
import type { CapRingColor } from "@/lib/theme/tokens";
import { cn } from "@/lib/cn";

type LeaderboardRowProps = {
  rank: number;
  initials: string;
  ring?: CapRingColor;
  name: string;
  sub?: string;
  points: number | string;
  /** Label under the points value — "Points" by default; the crew
   * leaderboard's "Red zone" tab uses "Chugs" instead. */
  pointsLabel?: string;
  /** Current-user highlight — independent of rank. */
  highlighted?: boolean;
  /** Navigates to a fixed route (e.g. a player's profile) as a real
   * `<Link>`. Mutually exclusive with `onClick`. */
  href?: string;
  onClick?: () => void;
};

const rowClasses = (highlighted: boolean) =>
  cn(
    "w-full flex items-center rounded-md border px-3 py-2.5 text-left",
    highlighted ? "bg-linear-to-r from-gold/15 to-surface-deep border-gold" : "bg-surface-deep border-cream/6",
  );

export function LeaderboardRow({
  rank,
  initials,
  ring = "gold",
  name,
  sub,
  points,
  pointsLabel = "Points",
  highlighted = false,
  href,
  onClick,
}: LeaderboardRowProps) {
  const isTop3 = rank <= 3;

  const content = (
    <>
      <div className={cn("font-mono font-semibold text-body w-6.5", isTop3 ? "text-gold" : "text-cream/40")}>
        {rank}
      </div>
      <AvatarChip initials={initials} ring={ring} size={32} className="mr-2.5" />
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-body-sm leading-[1.2] text-cream truncate">{name}</div>
        {sub && <div className="font-mono text-[9.5px] leading-[1.3] text-cream/40 mt-0.5 truncate">{sub}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono font-semibold text-body-sm text-gold">{points}</div>
        {pointsLabel !== "Points" && (
          <div className="font-mono text-[9px] tracking-kicker text-cream/35 uppercase mt-0.5">{pointsLabel}</div>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rowClasses(highlighted)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClasses(highlighted)}>
      {content}
    </button>
  );
}
