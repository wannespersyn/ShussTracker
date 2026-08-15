import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getAchievements } from "@/lib/db/achievements";
import { BackButton, Badge } from "@/components/ui";

export default async function PlayerAchievementsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: viewedId } = await params;
  const session = await requireSession();
  const viewerId = session.user.id;

  const player = await db.query.users.findFirst({ where: eq(users.id, viewedId) });
  if (!player) notFound();

  try {
    await requireSharesCrew(viewerId, viewedId);
  } catch {
    notFound();
  }

  const achievements = await getAchievements(viewedId);
  const earnedCount = achievements.filter((a) => a.earned).length;
  const progressPct = achievements.length > 0 ? Math.round((earnedCount / achievements.length) * 100) : 0;
  const name = player.name ?? "Player";

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-4.5">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/players/${viewedId}`} />
        <div>
          <div className="font-display text-display-sm text-cream">
            {viewerId === viewedId ? "Your achievements" : `${name.split(" ")[0]}'s achievements`}
          </div>
          <div className="font-mono font-medium text-[10px] tracking-widest text-cream/45 mt-1.5 uppercase">
            {earnedCount} of {achievements.length} unlocked
          </div>
        </div>
      </header>

      <div className="h-2 rounded-xs bg-cream/7 overflow-hidden">
        <div
          className="h-full rounded-xs bg-linear-to-r from-gold-dark to-gold"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-1">
        {achievements.map((a) => (
          <Badge
            key={a.id}
            glyph={a.glyph}
            name={a.name}
            sub={
              a.earned
                ? `Earned ${a.earnedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : a.description
            }
            ring={a.ring}
            locked={!a.earned}
          />
        ))}
      </div>
    </div>
  );
}
