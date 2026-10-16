import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getGameActivity, REACTIONS } from "@/lib/db/activity";
import { getCrewInsights } from "@/lib/db/crew-insights";
import { getLocale, getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { Avatar, Kicker, Screen } from "@/components/v2";
import { PhotoUpload } from "@/components/game/PhotoUpload";
import { ReactionIcon, REACTION_LABEL } from "@/components/game/ReactionIcon";
import { addCommentAction, deleteCommentAction, toggleReactionAction, uploadGamePhotoAction } from "./actions";

const ORD = ["1ST", "2ND", "3RD", "4TH"];

export default async function GamePage({ params }: Readonly<{ params: Promise<{ gameId: string }> }>) {
  const { gameId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
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

  const [activity, insights, t, locale] = await Promise.all([
    getGameActivity(gameId, userId),
    game.groupId ? getCrewInsights(game.groupId) : Promise.resolve(null),
    getT(),
    getLocale(),
  ]);
  const elo = insights?.gameElo[gameId] ?? {};
  const teams = [...game.teams].sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
  const multi = teams.length > 2;
  const when = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  }).format(game.playedAt);
  const matLabel = game.matType === "2" ? "1V1" : `${game.matType}-MAT`;
  const zoneTracked = game.teams.some((tm) => tm.players.some((p) => p.shots.some((s) => s.fieldHit !== "mama")));

  return (
    <Screen>
      <header className="flex items-center justify-between h-11">
        <Link
          href={game.groupId ? `/crews/${game.groupId}/feed` : "/home"}
          aria-label={t.common.back}
          className="w-11 h-11 rounded-pill bg-surface-panel border border-line text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex flex-col items-center">
          <span className="font-heading font-extrabold text-xl tracking-[0.08em]">{matLabel}</span>
          <span className="font-body text-xs text-cream/55">{when}</span>
        </span>
        <span className="w-11" />
      </header>

      <div
        className={cn(
          "relative rounded-[18px] overflow-hidden border border-line flex items-end justify-end p-3",
          game.photoUrl ? "h-56" : "h-28 bg-[repeating-linear-gradient(135deg,var(--color-surface-deep)_0_14px,var(--color-surface-raised)_14px_28px)]",
        )}
      >
        {game.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.photoUrl} alt={t.game.photoAlt} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="relative">
          <PhotoUpload
            action={uploadGamePhotoAction.bind(null, gameId)}
            hasPhoto={!!game.photoUrl}
            label={t.game.addPhoto}
            changeLabel={t.game.changePhoto}
          />
        </div>
      </div>

      <section className="rounded-[18px] bg-surface-deep border border-line overflow-hidden" aria-label={t.game.result}>
        {teams.map((tm, i) => {
          const won = tm.finalRank === 1;
          const teamMama = tm.players.reduce((n, p) => n + p.shots.filter((s) => s.fieldHit === "mama").length, 0);
          const d = elo[tm.players[0]?.userId ?? ""];
          return (
            <div key={tm.id} className={cn("flex items-center gap-3 px-3.5 py-3", i > 0 && "border-t border-line")}>
              <span
                className={cn(
                  "w-9 h-9 shrink-0 rounded-sm flex items-center justify-center font-display font-extrabold",
                  multi ? "text-[13px]" : "text-[17px]",
                  won ? "bg-amber text-ink" : "bg-surface-raised text-cream/55",
                )}
              >
                {multi ? ORD[(tm.finalRank ?? i + 1) - 1] : won ? "W" : "L"}
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-heading font-bold text-[19px] uppercase truncate">
                  {tm.players.map((p) => firstName(p.user.name ?? "Player")).join(" & ")}
                </span>
                <span className="font-body text-xs text-cream/55 truncate">
                  {tm.players
                    .map((p) => {
                      const m = p.shots.filter((s) => s.fieldHit === "mama").length;
                      return m > 0 ? `${firstName(p.user.name ?? "")} ${m} mama` : null;
                    })
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>
              <span className="flex flex-col items-end">
                {teamMama > 0 && <span className="font-heading font-bold text-[15px] text-red">{teamMama} MAMA</span>}
                {d !== undefined && (
                  <span className={cn("font-heading font-bold text-[15px]", d >= 0 ? "text-mint" : "text-red")}>
                    {d >= 0 ? "+" : "−"}
                    {Math.abs(d)} ELO
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </section>

      {zoneTracked && (
        <div className="grid grid-cols-5 gap-1.5">
          {(["1", "2", "3", "mama", "miss"] as const).map((fh) => {
            const n = game.teams.reduce((acc, tm) => acc + tm.players.reduce((a, p) => a + p.shots.filter((s) => s.fieldHit === fh).length, 0), 0);
            return (
              <div key={fh} className="rounded-sm bg-surface-deep border border-line py-2 text-center">
                <div className={cn("font-display font-extrabold text-xl", fh === "mama" ? "text-red" : "text-cream")}>{n}</div>
                <div className="font-body font-semibold text-[10px] uppercase tracking-[0.08em] text-cream/55">
                  {fh === "mama" ? "Mama" : fh === "miss" ? "Miss" : `Field ${fh}`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div role="group" aria-label={t.game.reactions} className="grid grid-cols-4 gap-2">
        {REACTIONS.map((r) => {
          const tally = activity.reactions.find((x) => x.reaction === r)!;
          return (
            <form key={r} action={toggleReactionAction.bind(null, gameId, r)}>
              <button
                type="submit"
                aria-pressed={tally.reactedByMe}
                aria-label={REACTION_LABEL[r]}
                className={cn(
                  "w-full h-12 rounded-[14px] border-2 flex items-center justify-center gap-1.5",
                  tally.reactedByMe ? "bg-amber/15 border-gold text-gold" : "bg-surface-deep border-line text-cream/75",
                )}
              >
                <ReactionIcon reaction={r} />
                <span className="font-display font-bold text-[17px]">{tally.count}</span>
              </button>
            </form>
          );
        })}
      </div>

      <section className="flex flex-col gap-2.5" aria-label={t.game.trashTalk}>
        <Kicker>{format(t.game.trashTalkN, { n: activity.comments.length })}</Kicker>
        {activity.comments.length === 0 && <p className="font-body text-sm text-cream/55">{t.game.noComments}</p>}
        {activity.comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.userName} />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 px-3 py-2 rounded-[4px_14px_14px_14px] bg-surface-deep">
              <span className="font-body font-bold text-xs">
                {firstName(c.userName)}{" "}
                <span className="font-medium text-cream/55">
                  ·{" "}
                  {new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }).format(c.createdAt)}
                </span>
              </span>
              <span className="font-body text-sm leading-[1.35] text-pretty">{c.text}</span>
            </div>
            {c.userId === userId && (
              <form action={deleteCommentAction.bind(null, gameId, c.id)} className="self-center">
                <button type="submit" aria-label={t.game.delete} className="w-8 h-8 text-cream/40">
                  ✕
                </button>
              </form>
            )}
          </div>
        ))}
        <form action={addCommentAction.bind(null, gameId)} className="flex gap-2">
          <input
            type="text"
            name="text"
            required
            maxLength={500}
            placeholder={t.game.placeholder}
            aria-label={t.game.placeholder}
            className="flex-1 h-12.5 rounded-pill bg-surface-panel border border-line px-4.5 font-body text-[15px] text-cream placeholder:text-cream/40 outline-none focus:border-gold/60"
          />
          <button type="submit" aria-label={t.game.send} className="w-12.5 h-12.5 rounded-pill bg-amber text-ink flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M4 12l16-8-6 16-3-7z" />
            </svg>
          </button>
        </form>
      </section>

      {game.groupId && (
        <Link
          href={`/log?rematch=${game.id}`}
          className="h-13 rounded-lg border-2 border-gold text-gold flex items-center justify-center font-heading font-extrabold text-lg tracking-[0.06em] uppercase"
        >
          {t.game.rematch}
        </Link>
      )}
    </Screen>
  );
}
