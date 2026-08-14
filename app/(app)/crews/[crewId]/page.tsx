import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewLeaderboard, getCrewRedZoneLeaderboard } from "@/lib/db/crews";
import { BackButton, Card, LinkButton } from "@/components/ui";
import { CrewLeaderboard } from "@/components/crews/CrewLeaderboard";

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

  const [season, tonight, redZone] = await Promise.all([
    getCrewLeaderboard(crewId),
    getCrewLeaderboard(crewId, { onlyToday: true }),
    getCrewRedZoneLeaderboard(crewId),
  ]);
  const hasGames = season.some((m) => m.gamesPlayed > 0);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href="/crews" />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Crew · {season.length} {season.length === 1 ? "member" : "members"}
          </div>
          <div className="font-display text-display-sm text-cream mt-1">{group.name}</div>
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
        <CrewLeaderboard currentUserId={userId} season={season} tonight={tonight} redZone={redZone} />
      )}

      <Card variant="gold" className="flex items-center gap-3.5">
        <div className="w-15 h-15 rounded-md bg-surface p-1.5 grid grid-cols-5 grid-rows-5 gap-0.75 shrink-0">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className={i % 3 === 0 ? "bg-cream" : "bg-transparent"} />
          ))}
        </div>
        <div>
          <div className="font-display text-lg text-surface leading-[1.1]">Drag a friend in</div>
          <div className="font-body text-body-sm text-surface/70 mt-0.5">
            Code <span className="tracking-[2px] font-semibold">{group.inviteCode}</span>. Somebody has to finish
            last.
          </div>
        </div>
      </Card>

      <LinkButton href={`/log?crewId=${crewId}`} className="mt-auto">
        Log a game with this crew
      </LinkButton>
    </div>
  );
}
