import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, requireSharesCrew } from "@/lib/db/authz";
import { getPlayerStatsSummary } from "@/lib/db/stats";
import { getPlayerCrews, getPlayerOpponents } from "@/lib/db/players";
import { getAchievements } from "@/lib/db/achievements";
import { initialsFor } from "@/lib/format";
import { AvatarChip, BackButton, Badge, Card } from "@/components/ui";
import { PlayerStatsSummary } from "@/components/players/PlayerStatsSummary";
import { SettingsIcon } from "@/components/ui/icons";

export default async function PlayerProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: viewedId } = await params;
  const session = await requireSession();
  const viewerId = session.user.id;
  const isSelf = viewerId === viewedId;

  const player = await db.query.users.findFirst({ where: eq(users.id, viewedId) });
  if (!player) notFound();

  try {
    await requireSharesCrew(viewerId, viewedId);
  } catch {
    notFound();
  }

  const [summary, crews, opponents, achievements] = await Promise.all([
    getPlayerStatsSummary(viewedId),
    getPlayerCrews(viewedId),
    getPlayerOpponents(viewedId),
    getAchievements(viewedId),
  ]);

  const name = player.name ?? "Player";
  const earnedAchievements = achievements.filter((a) => a.earned);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={isSelf ? "/home" : "/crews"} />
        <AvatarChip initials={initialsFor(name)} ring="gold" size={48} />
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45 truncate">
            {crews.map((c) => c.name).join(" · ") || "No crews yet"}
          </div>
          <div className="font-display text-display-sm text-cream truncate">{name}</div>
        </div>
        {isSelf && (
          <Link
            href="/settings"
            aria-label="Settings"
            className="w-10.5 h-10.5 shrink-0 rounded-md bg-cream/10 flex items-center justify-center text-cream"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        )}
      </header>

      {summary.totalGames === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">No games yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            {isSelf ? "Log your first game and your stats show up here." : `${name.split(" ")[0]} hasn't logged a game yet.`}
          </div>
        </Card>
      ) : (
        <PlayerStatsSummary summary={summary} displayName={name} isSelf={isSelf} />
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
            Achievements
          </div>
          <Link href={`/players/${viewedId}/achievements`} className="font-body text-body-sm text-gold">
            See all
          </Link>
        </div>
        {earnedAchievements.length === 0 ? (
          <div className="font-body text-body-sm text-cream/45">None yet — get flicking.</div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {earnedAchievements.slice(0, 4).map((a) => (
              <Badge key={a.id} glyph={a.glyph} name={a.name} sub={a.description} ring={a.ring} />
            ))}
          </div>
        )}
      </div>

      {opponents.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
            Head to head
          </div>
          <div className="flex flex-col gap-2">
            {opponents.slice(0, 8).map((o) => (
              <Link
                key={o.userId}
                href={`/players/${viewedId}/vs/${o.userId}`}
                className="flex items-center gap-3 rounded-xl bg-cream/5 border border-cream/10 px-3.5 py-3"
              >
                <AvatarChip initials={initialsFor(o.name)} size={38} />
                <div className="flex-1 font-heading font-semibold text-body-sm text-cream truncate">{o.name}</div>
                <div className="font-mono text-[10.5px] text-cream/40 shrink-0">{o.timesPlayed}× faced</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
