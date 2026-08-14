import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, gameTeamPlayers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { getCrewLeaderboard } from "@/lib/db/crews";
import { getBestDuo, getRecentGamesDetail, getShotDistribution } from "@/lib/db/stats";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { splitFlapDurations } from "@/lib/theme/tokens";
import { AvatarChip, Card, LeaderboardRow, LinkButton, StatCounter } from "@/components/ui";
import { signOutAction } from "@/app/(app)/actions";
import { ChevronRightIcon } from "@/components/ui/icons/ChevronRightIcon";

export default async function HomePage() {
  const session = await requireSession();
  const userId = session.user.id;
  const name = session.user.name ?? "Player";
  const firstName = name.split(" ")[0];

  // A user can belong to several crews — findFirst has no ordering, so it
  // can surface a 1-person crew ahead of the 7-person one that's actually
  // active. Feature the crew with the most members instead of an arbitrary
  // row.
  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: { with: { members: true } } },
  });
  const membership = [...memberships].sort(
    (a, b) => b.group.members.length - a.group.members.length,
  )[0];

  const played = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } }, shots: true },
  });

  const byRecent = [...played].sort(
    (a, b) => new Date(b.gameTeam.game.playedAt).getTime() - new Date(a.gameTeam.game.playedAt).getTime(),
  );
  const totalGames = byRecent.length;
  const wins = byRecent.filter((g) => g.gameTeam.finalRank === 1).length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  let streak = 0;
  for (const g of byRecent) {
    if (g.gameTeam.finalRank === 1) streak++;
    else break;
  }

  const riskZone = byRecent.reduce((sum, g) => sum + g.shots.filter((s) => s.fieldHit === "mama").length, 0);
  const losses = totalGames - wins;

  const leaderboard = membership ? (await getCrewLeaderboard(membership.groupId)).slice(0, 3) : [];
  const [shotDist, bestDuo, recentGames] = totalGames > 0
    ? await Promise.all([getShotDistribution(userId), getBestDuo(userId), getRecentGamesDetail(userId, 3)])
    : [null, null, []];

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <AvatarChip initials={initialsFor(name)} ring="gold" size={48} variant="light" />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Welcome back
          </div>
          <div className="font-display text-display-sm text-cream">{firstName}</div>
        </div>
        <form action={signOutAction} className="ml-auto">
          <button
            type="submit"
            className="font-heading font-bold text-[11px] tracking-[1.2px] uppercase text-cream/40"
          >
            Sign out
          </button>
        </form>
      </header>

      {!membership ? (
        <Card variant="flat" className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display text-2xl text-cream">No crew yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70">
            Start a crew or join one with a code to start logging games.
          </div>
          <LinkButton href="/crews">Find your crew</LinkButton>
        </Card>
      ) : totalGames === 0 ? (
        <Card variant="hero" className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display text-2xl text-cream">No games logged yet</div>
          <div className="font-body text-body-sm text-cream/60 max-w-70">
            Flick your first mat and your stats show up right here.
          </div>
          <LinkButton href="/log">Log a game</LinkButton>
        </Card>
      ) : (
        <>
          <Card variant="hero">
            <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/50">
              Win rate
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <StatCounter value={winRate} size={86} durationMs={splitFlapDurations.winRate} className="text-gold" />
              <span className="font-display text-[44px] text-gold/55">%</span>
            </div>
            <div className="font-body text-body-sm text-cream/65 mt-2">
              {wins} W · {losses} L. Statistically, you&apos;re a problem.
            </div>
          </Card>
          <div className="flex gap-3">
            <Card variant="default" className="flex-1">
              <div className="font-heading font-bold text-[12px] tracking-kicker uppercase text-cream/45">
                Streak
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <StatCounter value={streak} size={42} durationMs={splitFlapDurations.streak} className="text-cream" />
                <span className="font-heading font-bold text-[13px] tracking-[1.4px] text-gold">IN A ROW</span>
              </div>
            </Card>
            <Card variant="red" className="flex-1">
              <div className="font-heading font-bold text-[12px] tracking-kicker uppercase text-red-pale">
                Red zone
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <StatCounter
                  value={riskZone}
                  size={42}
                  durationMs={splitFlapDurations.riskZone}
                  className="text-red-bright"
                />
                <span className="font-heading font-bold text-[13px] tracking-[1.4px] text-red-bright/85">CHUGS</span>
              </div>
            </Card>
          </div>

          {shotDist && shotDist.bars.some((b) => b.count > 0) && (
            <Card variant="flat">
              <div className="flex justify-between items-baseline">
                <div className="font-heading font-bold text-[12px] tracking-kicker uppercase text-cream/50">
                  Where the caps land
                </div>
                <div className="font-display text-2xl text-cream">{shotDist.makeRate}%</div>
              </div>
              <div className="flex items-end gap-3.5 mt-3.5 h-24">
                {shotDist.bars.map((b) => (
                  <div key={b.fieldHit} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                    <div className="font-display text-base text-cream">{b.count}</div>
                    <div
                      className="w-full rounded-xs bg-cream/50"
                      style={{ height: `${Math.max(6, b.pct)}%` }}
                    />
                    <div className="font-heading font-bold text-[10.5px] tracking-[1.2px] text-cream/45 uppercase">
                      {b.label}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {bestDuo && bestDuo.wins + bestDuo.losses > 0 && (
            <Card variant="gold" className="flex items-center gap-3.5">
              <div className="flex -space-x-3">
                <AvatarChip initials={initialsFor(name)} ring="cream" size={46} variant="dark" />
                <AvatarChip initials={initialsFor(bestDuo.partnerName)} ring="cream" size={46} variant="dark" />
              </div>
              <div>
                <div className="font-heading font-bold text-[12px] tracking-kicker uppercase text-surface/65">
                  Best duo
                </div>
                <div className="font-display text-xl text-surface leading-[1.05]">
                  {firstName.toUpperCase()} &amp; {bestDuo.partnerName.split(" ")[0].toUpperCase()}
                </div>
                <div className="font-body font-semibold text-body-sm text-surface/70">
                  {bestDuo.wins}–{bestDuo.losses} together
                </div>
              </div>
            </Card>
          )}

          {recentGames.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
                Last nights
              </div>
              {recentGames.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg bg-cream/5 border-l-4 px-3.5 py-2.75",
                    g.result === "W" ? "border-gold" : "border-red",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center font-display text-sm",
                      g.result === "W" ? "bg-gold text-surface" : "bg-red text-cream",
                    )}
                  >
                    {g.result}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-semibold text-[15px] text-cream truncate">
                      vs {g.opponentLabel}
                    </div>
                    <div className="font-body text-caption text-cream/45">
                      {g.matType}-player mat · {new Date(g.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="font-display text-lg text-cream/62">
                    {g.myScore}–{g.oppScore}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {membership && leaderboard.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
              {membership.group.name}
            </div>
            <Link href={`/crews/${membership.groupId}`} className="font-body text-body-sm text-gold flex items-center gap-1">
              See all <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
          {leaderboard.map((row, i) => (
            <LeaderboardRow
              key={row.userId}
              rank={i + 1}
              initials={initialsFor(row.name)}
              name={row.name}
              sub={`${row.gamesPlayed} ${row.gamesPlayed === 1 ? "game" : "games"}`}
              points={row.wins}
              highlighted={row.userId === userId}
            />
          ))}
        </div>
      )}

      {membership && (
        <LinkButton href="/log" size="lg" className="w-full mt-auto">
          Log a game
        </LinkButton>
      )}
    </div>
  );
}
