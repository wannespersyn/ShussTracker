import { AvatarChip, Card } from "@/components/ui";
import { FlameIcon } from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ON_FIRE_STREAK, type PlayerStatsSummary as Summary } from "@/lib/db/stats";

const RING_CIRCUMFERENCE = 2 * Math.PI * 40;

/** Win-streak visual tiers — the flame and number get bigger and hotter,
 * a flame-colored ring hugs the hero card's actual border (a CSS
 * padding + mask trick, so it always sits flush on the edge and follows
 * the real corner radius — no SVG coordinate math to get wrong), a few
 * small flame icons sit on top of it for texture, and the card picks up
 * a pulsing glow, the longer the streak runs. Ordered hottest-first so
 * the first match wins; the last tier (min: 1) catches every streak so
 * `find` always resolves. `thickness: 0` means no border fire yet —
 * just the flame + number. Past red (real flames top out there), the
 * top two tiers borrow the "blue/white-hot" and "violet" ends of a
 * blackbody curve so streaks can keep escalating past 10. */
const STREAK_TIERS = [
  { min: 20, color: "text-purple-bright", ember: "rgba(166,107,224,.95)", core: "#f5eaff", flameSize: "w-9 h-9", numberSize: "text-4xl", thickness: 4, flames: 6, animDur: 1.2, pulseDuration: 0.7 },
  { min: 15, color: "text-blue-bright", ember: "rgba(79,168,232,.9)", core: "#eaf6ff", flameSize: "w-8.5 h-8.5", numberSize: "text-4xl", thickness: 3.5, flames: 6, animDur: 1.5, pulseDuration: 0.9 },
  { min: 10, color: "text-red-bright", ember: "rgba(224,91,78,.9)", core: "#ffe08a", flameSize: "w-8 h-8", numberSize: "text-3xl", thickness: 3, flames: 6, animDur: 1.8, pulseDuration: 1.1 },
  { min: 7, color: "text-red-bright", ember: "rgba(224,91,78,.75)", core: "#ffd76a", flameSize: "w-7 h-7", numberSize: "text-3xl", thickness: 3, flames: 4, animDur: 2.2, pulseDuration: 1.8 },
  { min: 5, color: "text-gold", ember: "rgba(232,179,60,.7)", core: "#fff0b0", flameSize: "w-6.5 h-6.5", numberSize: "text-2xl", thickness: 2.5, flames: 3, animDur: 2.8, pulseDuration: 2.4 },
  { min: ON_FIRE_STREAK, color: "text-gold", ember: "rgba(232,179,60,.55)", core: "#fff6cf", flameSize: "w-6 h-6", numberSize: "text-2xl", thickness: 2, flames: 2, animDur: 3.4, pulseDuration: undefined },
  { min: 1, color: "text-cream/70", ember: "rgba(232,179,60,.2)", core: "#fff6cf", flameSize: "w-5 h-5", numberSize: "text-lg", thickness: 0, flames: 0, animDur: 0, pulseDuration: undefined },
] as const;

/** Fixed spots for the flame accents that sit on the ring — bottom edge
 * first (fire "sits" there), spreading to the sides for hotter tiers.
 * Kept a few px inside the card since it clips overflow. */
const FLAME_SPOTS = [
  { key: "a", style: { left: "14%", bottom: "3px" }, size: "w-4 h-4", delay: "0s" },
  { key: "b", style: { left: "42%", bottom: "5px" }, size: "w-5 h-5", delay: "0.3s" },
  { key: "c", style: { left: "70%", bottom: "3px" }, size: "w-4 h-4", delay: "0.15s" },
  { key: "d", style: { right: "4px", bottom: "22%" }, size: "w-3.5 h-3.5", delay: "0.45s" },
  { key: "e", style: { left: "4px", bottom: "22%" }, size: "w-3.5 h-3.5", delay: "0.6s" },
  { key: "f", style: { left: "88%", bottom: "4px" }, size: "w-3.5 h-3.5", delay: "0.2s" },
] as const;

/** A flame-colored ring hugging the card's real border via `padding` +
 * a two-layer `mask` (content-box vs. border-box, XOR'd together) — the
 * classic CSS gradient-border trick. It always follows the element's
 * actual size and `border-radius`, unlike an SVG overlay with its own
 * coordinate space. The color drifts slowly along a repeating diagonal
 * gradient for a gentle simmer, not a glitchy flicker. */
function FireBorder({ tier }: Readonly<{ tier: (typeof STREAK_TIERS)[number] }>) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 rounded-xl pointer-events-none animate-fire-flow"
        style={
          {
            padding: tier.thickness,
            background: `repeating-linear-gradient(45deg, ${tier.ember} 0px, ${tier.core} 8px, ${tier.ember} 16px)`,
            animationDuration: `${tier.animDur}s`,
            WebkitMaskImage: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskImage: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
          } as React.CSSProperties
        }
      />
      {FLAME_SPOTS.slice(0, tier.flames).map((spot) => (
        <FlameIcon
          key={spot.key}
          className={cn(spot.size, "absolute pointer-events-none", tier.color)}
          style={{ ...spot.style, animation: "flicker 1.3s ease-in-out infinite", animationDelay: spot.delay }}
        />
      ))}
    </>
  );
}

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
  const { totalGames, wins, winRate, streak, longestStreak, riskZone, shotDist, bestDuo, recentGames } = summary;
  const firstName = displayName.split(" ")[0];

  if (totalGames === 0) return null;

  const ringOffset = (winRate / 100) * RING_CIRCUMFERENCE;
  const streakTier = streak > 0 ? STREAK_TIERS.find((t) => streak >= t.min)! : undefined;

  return (
    <>
      <Card
        variant="hero"
        className="relative overflow-hidden"
        style={
          streakTier?.pulseDuration
            ? ({
                "--ember-color": streakTier.ember,
                animation: `emberPulse ${streakTier.pulseDuration}s ease-in-out infinite`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className="absolute -right-13 -top-13 w-42.5 h-42.5 rounded-pill pointer-events-none"
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
            <div className="flex flex-wrap items-center gap-1.75 mt-3">
              {streakTier && (
                <span className="inline-flex items-center gap-1 shrink-0">
                  <FlameIcon
                    className={cn(streakTier.flameSize, "shrink-0", streakTier.color)}
                    style={{ animation: "flicker 1.3s ease-in-out infinite" }}
                  />
                  <span className={cn("font-display leading-none", streakTier.numberSize, streakTier.color)}>
                    {streak}
                  </span>
                </span>
              )}
              {longestStreak > 1 && longestStreak !== streak && (
                <span className="inline-flex items-center gap-1 font-mono font-semibold text-[10px] tracking-[0.08em] text-cream/70 bg-cream/10 rounded-pill px-2.25 py-1.5">
                  {longestStreak >= ON_FIRE_STREAK && (
                    <FlameIcon className="w-2.75 h-2.75 shrink-0 text-cream/60" />
                  )}
                  Longest Win Streak: {longestStreak}
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
