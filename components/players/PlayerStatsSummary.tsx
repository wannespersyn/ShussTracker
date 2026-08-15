import { AvatarChip, Card } from "@/components/ui";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PlayerStatsSummary as Summary } from "@/lib/db/stats";

const RING_CIRCUMFERENCE = 2 * Math.PI * 40;

/** The win-rate hero / stat-grid / shot-distribution / best-partner /
 * recent-games card cluster — shared by Home ("you") and a player's
 * profile page (any player). Renders nothing if they have no games yet;
 * callers own their own empty state.
 *
 * `hideShotDist` skips the "Where the caps land" card — Home leaves that
 * to the Stats explorer so the two screens don't read as duplicates.
 * `isSelf` controls whether the recent-games row says "You" or the
 * player's first name (it's wrong to say "You" when viewing someone
 * else's profile). */
export function PlayerStatsSummary({
  summary,
  displayName,
  isSelf = true,
  hideShotDist = false,
}: Readonly<{ summary: Summary; displayName: string; isSelf?: boolean; hideShotDist?: boolean }>) {
  const { totalGames, wins, winRate, streak, riskZone, shotDist, bestDuo, recentGames } = summary;
  const firstName = displayName.split(" ")[0];

  if (totalGames === 0) return null;

  const ringOffset = (winRate / 100) * RING_CIRCUMFERENCE;

  return (
    <>
      <Card variant="hero" className="relative overflow-hidden">
        <div
          className="absolute -right-13 -top-13 w-42.5 h-42.5 rounded-pill pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(232,179,60,.22), transparent 68%)" }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="font-mono font-medium text-[10px] tracking-[0.18em] text-gold/80 uppercase">
              Win rate · 30 days
            </div>
            <div className="flex items-baseline mt-3">
              <span className="font-display text-display-xl text-gold">{winRate}</span>
              <span className="font-display text-[38px] text-gold">%</span>
            </div>
            <div className="flex gap-1.75 mt-3">
              {streak > 0 && (
                <span className="font-mono font-semibold text-[10px] tracking-[0.08em] text-ink bg-gold rounded-pill px-2.25 py-1.5">
                  W{streak} STREAK
                </span>
              )}
            </div>
          </div>
          <svg width={92} height={92} className="mt-1.5">
            <circle cx={46} cy={46} r={40} fill="none" stroke="rgba(239,231,214,.1)" strokeWidth={11} />
            <circle
              cx={46}
              cy={46}
              r={40}
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${ringOffset} ${RING_CIRCUMFERENCE}`}
              transform="rotate(-90 46 46)"
            />
            <text x={46} y={43} textAnchor="middle" fill="var(--color-cream)" className="font-mono font-semibold text-[15px]">
              {wins}
            </text>
            <text
              x={46}
              y={58}
              textAnchor="middle"
              fill="rgba(239,231,214,.45)"
              className="font-mono font-medium text-[8px] tracking-widest"
            >
              WINS
            </text>
          </svg>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.25">
        <Card variant="default" className="p-3.25">
          <div className="font-mono font-semibold text-[22px] text-cream">{totalGames}</div>
          <div className="font-heading font-medium text-[9.5px] tracking-widest text-cream/45 uppercase mt-1.5">
            Games
          </div>
        </Card>
        <Card variant="default" className="p-3.25 border-red/30">
          <div className="font-mono font-semibold text-[22px] text-red-bright">{riskZone}</div>
          <div className="font-heading font-medium text-[9.5px] tracking-widest text-cream/45 uppercase mt-1.5">
            Mama hits
          </div>
        </Card>
        <Card variant="default" className="p-3.25">
          <div className="font-mono font-semibold text-[22px] text-cream">
            {shotDist?.makeRate ?? 0}
            <span className="text-[13px]">%</span>
          </div>
          <div className="font-heading font-medium text-[9.5px] tracking-widest text-cream/45 uppercase mt-1.5">
            Hit rate
          </div>
        </Card>
      </div>

      {!hideShotDist && shotDist && shotDist.bars.some((b) => b.count > 0) && (
        <Card variant="flat">
          <div className="flex justify-between items-baseline">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/50">
              Where the caps land
            </div>
            <div className="font-mono font-semibold text-body text-cream">{shotDist.makeRate}%</div>
          </div>
          <div className="flex items-end gap-3.5 mt-3.5 h-24">
            {shotDist.bars.map((b) => (
              <div key={b.fieldHit} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                <div className="font-mono font-semibold text-sm text-cream">{b.count}</div>
                <div className="w-full rounded-xs bg-cream/50" style={{ height: `${Math.max(6, b.pct)}%` }} />
                <div className="font-heading font-medium text-[10.5px] tracking-[0.08em] text-cream/45 uppercase">
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {bestDuo && bestDuo.wins + bestDuo.losses > 0 && (
        <Card variant="flat" className="flex items-center gap-3.5">
          <div className="flex -space-x-2">
            <AvatarChip initials={initialsFor(displayName)} ring="cream" size={34} />
            <AvatarChip initials={initialsFor(bestDuo.partnerName)} ring="cream" size={34} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-semibold text-[10.5px] tracking-kicker uppercase text-cream/50">
              Best partner
            </div>
            <div className="font-heading font-semibold text-heading text-cream leading-[1.2] mt-0.5 truncate">
              {firstName} &amp; {bestDuo.partnerName.split(" ")[0]}
            </div>
            <div className="font-mono text-[10px] text-cream/42 mt-0.5">
              {bestDuo.wins}-{bestDuo.losses} together
            </div>
          </div>
          <div className="font-display text-2xl text-gold shrink-0">
            {Math.round((bestDuo.wins / (bestDuo.wins + bestDuo.losses)) * 100)}%
          </div>
        </Card>
      )}

      {recentGames.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Recent games
            </span>
          </div>
          {recentGames.map((g) => (
            <div key={g.id} className="bg-surface-deep border border-cream/7 rounded-lg px-3.5 py-3.25 flex flex-col gap-2.25">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium text-[9.5px] tracking-[0.12em] text-cream/40 uppercase">
                  {g.matType}-PLAYER MAT ·{" "}
                  {new Date(g.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span
                  className={cn(
                    "font-mono font-semibold text-[9.5px] tracking-widest px-2 py-1 rounded-pill",
                    g.result === "W" ? "bg-gold/16 text-gold" : "bg-red/16 text-red-bright",
                  )}
                >
                  {g.result === "W" ? "WON" : "LOST"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-sm text-cream w-28 truncate">
                  {isSelf ? "You" : firstName}
                </span>
                <span className="flex items-center gap-2.25">
                  <span className="font-mono font-semibold text-[19px] text-gold">{g.myScore}</span>
                  <span className="font-display text-xs text-cream/35">VS</span>
                  <span className="font-mono font-semibold text-[19px] text-cream/55">{g.oppScore}</span>
                </span>
                <span className="font-heading font-semibold text-sm text-cream/60 w-28 text-right truncate">
                  {g.opponentLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
