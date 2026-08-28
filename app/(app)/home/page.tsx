import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { getCrewLeaderboard } from "@/lib/db/crews";
import { getPlayerStatsSummary } from "@/lib/db/stats";
import { initialsFor } from "@/lib/format";
import { AvatarChip, Card, LeaderboardRow, LinkButton } from "@/components/ui";
import { PlayerStatsSummary } from "@/components/players/PlayerStatsSummary";
import { ChevronRightIcon } from "@/components/ui/icons/ChevronRightIcon";
import { SettingsIcon } from "@/components/ui/icons/SettingsIcon";

export default async function HomePage() {
  const session = await requireSession();
  const userId = session.user.id;
  const name = session.user.name ?? "Player";

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

  const summary = await getPlayerStatsSummary(userId);
  const leaderboard = membership ? (await getCrewLeaderboard(membership.groupId)).slice(0, 3) : [];

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-3.5 pb-30 gap-4.5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.75">
          <AvatarChip initials={initialsFor(name)} ring="gold" size={42} />
          <div>
            <div className="font-heading font-semibold text-base text-cream">{name}</div>
          </div>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-9.5 h-9.5 rounded-md bg-surface-panel border border-gold/16 flex items-center justify-center"
        >
          <SettingsIcon className="w-4.5 h-4.5 text-cream" />
        </Link>
      </header>

      {!membership ? (
        <Card variant="flat" className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display text-2xl text-cream">No crew yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70">
            Start a crew or join one with a code to start logging games.
          </div>
          <LinkButton href="/crews">Find your crew</LinkButton>
        </Card>
      ) : summary.totalGames === 0 ? (
        <Card variant="hero" className="text-center py-8 flex flex-col items-center gap-3">
          <div className="font-display text-2xl text-cream">No games logged yet</div>
          <div className="font-body text-body-sm text-cream/60 max-w-70">
            Flick your first mat and your stats show up right here.
          </div>
          <LinkButton href="/log">Log a game</LinkButton>
        </Card>
      ) : (
        <PlayerStatsSummary summary={summary} displayName={name} hideShotDist />
      )}

      {membership && leaderboard.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              {membership.group.name}
            </span>
            <Link href={`/crews/${membership.groupId}`} className="font-body text-body-sm text-gold flex items-center gap-1">
              See all <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
          {leaderboard.map((row, i) => (
            <LeaderboardRow
              key={row.userId}
              href={`/players/${row.userId}`}
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
    </div>
  );
}
