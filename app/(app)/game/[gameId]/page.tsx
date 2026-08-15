import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { Card, LinkButton } from "@/components/ui";
import { cn } from "@/lib/cn";

const FIELD_HITS = ["3", "2", "1", "mama", "miss"] as const;

export default async function GameReplayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    with: {
      teams: { with: { players: { with: { user: true, shots: true } } } },
    },
  });
  if (!game) notFound();

  if (game.groupId) {
    try {
      await requireGroupMember(userId, game.groupId);
    } catch {
      notFound();
    }
  } else if (game.createdBy !== userId) {
    notFound();
  }

  const teams = [...game.teams].sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
  const allShots = game.teams.flatMap((t) => t.players.flatMap((p) => p.shots));
  const tally = FIELD_HITS.map((fh) => ({
    fieldHit: fh,
    label: fh === "mama" ? "RISK" : fh === "miss" ? "MISS" : fh,
    n: allShots.filter((s) => s.fieldHit === fh).length,
  }));

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header>
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
          Game recap
        </div>
        <div className="font-display text-display-sm text-cream mt-1">{game.matType}-player mat</div>
        <div className="font-body text-body-sm text-cream/45 mt-1">
          {new Date(game.playedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {teams.map((t) => {
          const isWinner = t.finalRank === 1;
          return (
            <Card key={t.id} variant={isWinner ? "gold" : "default"} className="flex items-center gap-3.5">
              <div
                className={cn(
                  "w-11.5 h-11.5 shrink-0 rounded-pill flex items-center justify-center font-mono font-semibold text-xl",
                  isWinner ? "bg-gold text-ink" : "bg-cream/10 text-cream",
                )}
              >
                {t.finalRank ?? "–"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-heading text-cream truncate">
                  {t.players.map((p) => p.user.name ?? "Player").join(" & ")}
                </div>
                <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/45 mt-1">
                  {t.teamLabel}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {allShots.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
            Shot tally
          </div>
          <div className="flex gap-2">
            {tally.map((t) => (
              <div key={t.fieldHit} className="flex-1 text-center py-3 rounded-md bg-cream/5">
                <div className="font-mono font-semibold text-2xl text-cream">{t.n}</div>
                <div className="font-heading font-semibold text-[11px] tracking-[1.2px] text-cream/45 uppercase">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <LinkButton href="/home" variant="outline" className="mt-auto">
        Back home
      </LinkButton>
    </div>
  );
}
