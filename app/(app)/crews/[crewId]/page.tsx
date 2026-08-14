import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewLeaderboard } from "@/lib/db/crews";
import { initialsFor } from "@/lib/format";
import { Card, LeaderboardRow, LinkButton } from "@/components/ui";
import type { CapRingColor } from "@/lib/theme/tokens";

const RING_CYCLE: CapRingColor[] = ["gold", "red", "mint", "cream"];

export default async function CrewPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  try {
    await requireGroupMember(userId, crewId);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, crewId) });
  if (!group) notFound();

  const leaderboard = await getCrewLeaderboard(crewId);
  const hasGames = leaderboard.some((m) => m.gamesPlayed > 0);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header>
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
          Crew
        </div>
        <div className="font-display text-display-sm text-cream mt-1">{group.name}</div>
        <div className="font-body text-body-sm text-cream/45 mt-1">
          Invite code <span className="text-gold tracking-[2px]">{group.inviteCode}</span> · {leaderboard.length}{" "}
          {leaderboard.length === 1 ? "member" : "members"}
        </div>
      </header>

      {!hasGames ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">No games yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            Log your crew&apos;s first game and the leaderboard fills in here.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {leaderboard.map((row, i) => (
            <LeaderboardRow
              key={row.userId}
              rank={i + 1}
              initials={initialsFor(row.name)}
              ring={RING_CYCLE[i % RING_CYCLE.length]}
              name={row.name}
              sub={`${row.gamesPlayed} ${row.gamesPlayed === 1 ? "game" : "games"}`}
              points={row.wins}
              highlighted={row.userId === userId}
            />
          ))}
        </div>
      )}

      <LinkButton href={`/log?crewId=${crewId}`} className="mt-auto">
        Log a game with this crew
      </LinkButton>
    </div>
  );
}
