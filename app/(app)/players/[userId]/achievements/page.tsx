import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getPlayerAchievements } from "@/lib/db/player-achievements";
import { getT } from "@/lib/i18n/server";
import { Screen } from "@/components/v2";
import { AchievementGrid } from "@/components/players/AchievementGrid";

export default async function PlayerAchievementsPage({ params }: Readonly<{ params: Promise<{ userId: string }> }>) {
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

  const [items, t] = await Promise.all([getPlayerAchievements(viewedId, new Date()), getT()]);
  const got = items.filter((a) => a.got).length;

  return (
    <Screen nav={false} className="pb-6">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/players/${viewedId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display font-extrabold text-[26px] tracking-[0.04em] uppercase truncate">
          {viewerId === viewedId ? "Achievements" : `${(player.name ?? "Player").split(" ")[0]}`}
        </h1>
        <span className="font-display font-extrabold text-[22px] text-gold">
          {got} / {items.length}
        </span>
      </header>
      <AchievementGrid items={items} />
    </Screen>
  );
}
