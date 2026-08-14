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
  /** Current-user highlight — independent of rank. */
  highlighted?: boolean;
  onClick?: () => void;
};

export function LeaderboardRow({
  rank,
  initials,
  ring = "gold",
  name,
  sub,
  points,
  highlighted = false,
  onClick,
}: LeaderboardRowProps) {
  const isFirst = rank === 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left",
        highlighted ? "bg-gold/10 border-gold/30" : "bg-cream/5 border-cream/10",
      )}
    >
      <div className={cn("font-display text-heading w-[30px]", isFirst ? "text-gold" : "text-cream/45")}>
        {rank}
      </div>
      <AvatarChip initials={initials} ring={ring} size={40} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[20px] leading-[1.1] text-cream truncate">{name}</div>
        {sub && <div className="font-body text-[12.5px] text-cream/45 truncate">{sub}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className={cn("font-display text-[22px]", isFirst ? "text-gold" : "text-cream")}>{points}</div>
        <div className="font-heading font-semibold text-[11px] tracking-[1.2px] text-cream/35 uppercase">
          Points
        </div>
      </div>
    </button>
  );
}
