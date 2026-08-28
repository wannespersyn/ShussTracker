import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getCrewActivityFeed, REACTION_GLYPH } from "@/lib/db/activity";
import { BackButton, Card } from "@/components/ui";

export default async function CrewFeedPage({ params }: { params: Promise<{ crewId: string }> }) {
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

  const feed = await getCrewActivityFeed(crewId, userId);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${crewId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            {group.name}
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Activity feed</div>
        </div>
      </header>

      {feed.length === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">Quiet so far</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            Log a game and the crew can start piling on reactions and trash talk here.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {feed.map((g) => {
            const winner = g.teams.find((t) => t.finalRank === 1);
            const rest = g.teams.filter((t) => t !== winner);
            const activeReactions = g.reactions.filter((r) => r.count > 0);
            return (
              <Link key={g.id} href={`/game/${g.id}`}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-heading font-semibold text-body text-cream truncate">
                      {winner?.playerNames.join(" & ") ?? "?"}
                      {rest.length > 0 && (
                        <span className="text-cream/40"> beat {rest.map((t) => t.playerNames.join(" & ")).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40">
                    {g.matType}-player mat ·{" "}
                    {new Date(g.playedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {activeReactions.length > 0 && (
                      <div className="flex items-center gap-2">
                        {activeReactions.map((r) => (
                          <span key={r.reaction} className="font-mono text-[12.5px] text-cream/60">
                            {REACTION_GLYPH[r.reaction]} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                    {g.commentCount > 0 && (
                      <span className="font-mono text-[12.5px] text-cream/45">
                        {g.commentCount} {g.commentCount === 1 ? "comment" : "comments"}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
