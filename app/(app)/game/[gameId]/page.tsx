import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getGameActivity, REACTION_GLYPH, REACTIONS } from "@/lib/db/activity";
import { Card, LinkButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addCommentAction, deleteCommentAction, toggleReactionAction } from "./actions";

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

  const activity = await getGameActivity(gameId, userId);

  const teams = [...game.teams].sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
  const allShots = game.teams.flatMap((t) => t.players.flatMap((p) => p.shots));
  const hasZoneData = allShots.some((s) => s.fieldHit === "2" || s.fieldHit === "3");
  const tallyFieldHits = hasZoneData ? FIELD_HITS : (["1", "mama", "miss"] as const);
  const tally = tallyFieldHits.map((fh) => ({
    fieldHit: fh,
    label: fh === "mama" ? "RISK" : fh === "miss" ? "MISS" : hasZoneData ? fh : "HIT",
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

      <div className="flex flex-col gap-3">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Reactions
        </div>
        <div className="flex gap-2">
          {REACTIONS.map((r) => {
            const t = activity.reactions.find((x) => x.reaction === r)!;
            const react = toggleReactionAction.bind(null, gameId, r);
            return (
              <form key={r} action={react}>
                <button
                  type="submit"
                  className={cn(
                    "h-11 px-3.5 rounded-pill flex items-center gap-1.5 border-2 font-mono font-semibold text-sm",
                    t.reactedByMe ? "bg-gold/14 border-gold/45 text-gold" : "bg-cream/5 border-cream/10 text-cream/70",
                  )}
                >
                  <span>{REACTION_GLYPH[r]}</span>
                  {t.count > 0 && <span>{t.count}</span>}
                </button>
              </form>
            );
          })}
        </div>

        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40 mt-2">
          Trash talk
        </div>
        <div className="flex flex-col gap-2">
          {activity.comments.length === 0 && (
            <div className="font-body text-body-sm text-cream/45">No comments yet — say something.</div>
          )}
          {activity.comments.map((c) => {
            const del = deleteCommentAction.bind(null, gameId, c.id);
            return (
              <div key={c.id} className="rounded-lg bg-cream/5 border border-cream/10 px-3.5 py-2.75">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading font-semibold text-[13px] text-cream">{c.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-cream/35">
                      {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    {c.userId === userId && (
                      <form action={del}>
                        <button type="submit" className="font-heading font-bold text-[10px] tracking-[1px] uppercase text-cream/30">
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="font-body text-[14px] text-cream/75 mt-1 text-pretty">{c.text}</div>
              </div>
            );
          })}
        </div>
        <form action={addCommentAction.bind(null, gameId)} className="flex gap-2">
          <input
            type="text"
            name="text"
            required
            maxLength={500}
            placeholder="Say something…"
            className="flex-1 h-12 rounded-md bg-cream/8 px-3.5 font-body text-[14px] text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
          />
          <button type="submit" className="h-12 px-4 rounded-md bg-gold font-heading font-bold text-sm text-ink">
            Post
          </button>
        </form>
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        {game.groupId && <LinkButton href={`/log?rematch=${game.id}`}>Rematch</LinkButton>}
        <LinkButton href="/home" variant="outline">
          Back home
        </LinkButton>
      </div>
    </div>
  );
}
