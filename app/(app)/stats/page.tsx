import { requireSession } from "@/lib/db/authz";
import { getStatsExplorerData } from "@/lib/db/stats";
import { Card, LinkButton } from "@/components/ui";
import { StatsExplorer } from "@/components/stats/StatsExplorer";

export default async function StatsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const data = await getStatsExplorerData(userId);

  if (data.crews.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 pb-16">
        <Card variant="flat" className="text-center py-8 flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="font-display text-2xl text-cream">No crew yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70">
            Join or start a crew to start slicing your stats.
          </div>
          <LinkButton href="/crews">Find your crew</LinkButton>
        </Card>
      </div>
    );
  }

  if (data.games.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 pb-16">
        <Card variant="hero" className="text-center py-8 flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="font-display text-2xl text-cream">No games logged yet</div>
          <div className="font-body text-body-sm text-cream/60 max-w-70">
            Flick your first mat and this page fills up fast.
          </div>
          <LinkButton href="/log">Log a game</LinkButton>
        </Card>
      </div>
    );
  }

  return <StatsExplorer data={data} currentUserId={userId} />;
}
