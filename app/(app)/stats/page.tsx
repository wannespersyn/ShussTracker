import { requireSession } from "@/lib/db/authz";
import { getStatsExplorerData } from "@/lib/db/stats";
import { Card, LinkButton } from "@/components/ui";
import { DeepStats } from "@/components/stats/DeepStats";
import { getT } from "@/lib/i18n/server";

export default async function StatsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [data, t] = await Promise.all([getStatsExplorerData(userId), getT()]);

  if (data.crews.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 pb-16">
        <Card variant="flat" className="text-center py-8 flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="font-display text-2xl text-cream">{t.more.noCrew}</div>
          <div className="font-body text-body-sm text-muted max-w-70">
            {t.empty.statsNoCrew}
          </div>
          <LinkButton href="/crews">{t.home.findCrew}</LinkButton>
        </Card>
      </div>
    );
  }

  if (data.games.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 pb-16">
        <Card variant="hero" className="text-center py-8 flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="font-display text-2xl text-cream">{t.empty.statsNoGames}</div>
          <div className="font-body text-body-sm text-muted max-w-70">
            {t.empty.statsNoGamesBody}
          </div>
          <LinkButton href="/log">{t.home.logGame}</LinkButton>
        </Card>
      </div>
    );
  }

  return <DeepStats data={data} currentUserId={userId} backHref={`/players/${userId}`} />;
}
