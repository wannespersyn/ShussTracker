/**
 * Americano TV — Route: /americano/[rotationId]/tv
 *
 * Big-screen view for a TV or laptop in the room: round progress, the games
 * on each mat, who sits out, what's next and the standings. Refreshes itself
 * every 15 s. Requires crew membership.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getRotation } from "@/lib/db/rotations";
import { matsNow, rotationProgress } from "@/lib/rotation-view";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { RoundProgress } from "@/components/rotation/RotationScreens";
import { AutoRefresh } from "@/components/rotation/AutoRefresh";

export default async function RotationTvPage({ params }: Readonly<{ params: Promise<{ rotationId: string }> }>) {
  const { rotationId } = await params;
  const session = await requireSession();
  const rotation = await getRotation(rotationId);
  if (!rotation) notFound();
  try {
    await requireGroupMember(session.user.id, rotation.groupId);
  } catch {
    notFound();
  }
  const t = await getT();
  const R = t.rot;
  const nameOf = new Map(rotation.players.map((p) => [p.id, firstName(p.name)]));
  const name = (id: string) => nameOf.get(id) ?? t.more.player;
  const duo = (ids: readonly string[]) => ids.map(name).join(" & ");
  const { now, queue } = matsNow(rotation);
  const p = rotationProgress(rotation);
  const rest = rotation.byes[p.current] ?? [];
  const live = rotation.status !== "completed";

  return (
    <div className="min-h-screen bg-surface text-cream flex flex-col gap-5.5 px-[clamp(20px,3vw,48px)] py-[clamp(20px,3vw,40px)]">
      <AutoRefresh seconds={15} />
      <header className="flex items-center gap-6">
        <Link href={`/americano/${rotation.id}`} aria-label={t.common.back} className="shrink-0">
          <svg width="40" height="40" viewBox="0 0 30 30" aria-hidden="true">
            <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeDasharray="3 2.2" />
            <circle cx="15" cy="15" r="8" fill="var(--color-gold)" />
          </svg>
        </Link>
        <span className="flex flex-col min-w-0">
          <span className="font-display font-extrabold text-[clamp(24px,2.6vw,40px)] leading-none uppercase truncate">{rotation.name}</span>
          <span className="font-body text-base text-muted">
            {format(R.meta, { mode: rotation.mode === "americano" ? R.americano : R.mexicano, n: rotation.players.length, m: rotation.mats })}
          </span>
        </span>
        <div className="flex-1 px-6 hidden md:block">{live && <RoundProgress v={rotation} R={R} big />}</div>
        <span className={cn("flex items-center gap-2 px-3.5 py-2 rounded-lg font-heading font-extrabold text-lg tracking-[0.14em]", live ? "bg-red text-ink" : "bg-surface-raised text-muted")}>
          {live && <span className="w-2.5 h-2.5 rounded-pill bg-ink" />}
          {live ? R.live : R.done}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        <div className="flex-[2] min-w-0 flex flex-col gap-4.5">
          <div className="flex-1 grid gap-4.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(now.length, 3))}, minmax(0, 1fr))` }}>
            {now.map((g, i) => (
              <article key={g.id} className="flex flex-col rounded-[24px] bg-surface-deep border-2 border-gold/45 overflow-hidden">
                <div className="px-5.5 py-3.5 bg-amber/12 font-heading font-extrabold text-[22px] tracking-[0.16em] text-gold">{format(R.mat, { n: i + 1 })}</div>
                <div className="flex-1 flex flex-col justify-center gap-3.5 p-5.5">
                  <span className="font-display font-extrabold text-[clamp(32px,3.6vw,56px)] leading-[0.95] uppercase">{duo(g.a)}</span>
                  <span className="flex items-center gap-3.5">
                    <span className="h-0.5 flex-1 bg-cream/10" />
                    <span className="font-heading font-extrabold text-xl tracking-[0.2em] text-muted">{R.vs}</span>
                    <span className="h-0.5 flex-1 bg-cream/10" />
                  </span>
                  <span className="font-display font-extrabold text-[clamp(32px,3.6vw,56px)] leading-[0.95] uppercase">{duo(g.b)}</span>
                </div>
              </article>
            ))}
            {now.length === 0 && live && (
              <p className="self-center font-body text-xl text-muted">{format(R.waitingRound, { n: rotation.plannedRounds + 1 })}</p>
            )}
          </div>
          {live && (rest.length > 0 || queue.length > 0) && (
            <div className="flex flex-wrap gap-4.5">
              {rest.length > 0 && (
                <div className="flex items-center gap-3.5 px-5 py-4 rounded-[18px] bg-surface-deep border border-dashed border-cream/20">
                  <span className="font-heading font-bold text-base tracking-[0.14em] text-muted">{R.tvRest}</span>
                  <span className="font-display font-extrabold text-[28px] uppercase">{rest.map(name).join(", ")}</span>
                </div>
              )}
              {queue.length > 0 && (
                <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 rounded-[18px] bg-surface-deep border border-line">
                  <span className="font-heading font-bold text-base tracking-[0.14em] text-muted">{R.nextShort}</span>
                  {queue.slice(0, 2).map((g) => (
                    <span key={g.id} className="font-body font-semibold text-xl text-soft">
                      {duo(g.a)} <span className="text-[#5b6460]">vs</span> {duo(g.b)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <section aria-label={R.tvStandings} className="flex-1 min-w-0 flex flex-col rounded-[24px] bg-surface-deep border border-line overflow-hidden">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_64px_56px] gap-2.5 px-5 pt-4 pb-2.5 font-heading font-bold text-sm tracking-[0.14em] text-muted">
            <span>#</span>
            <span>{R.tvStandings}</span>
            <span className="text-right">{R.colWL}</span>
            <span className="text-right">{R.colElo}</span>
          </div>
          {rotation.standings.map((s, i) => (
            <div key={s.userId} className={cn("grid grid-cols-[32px_minmax(0,1fr)_64px_56px] gap-2.5 items-center px-5 py-2.25 border-t border-cream/6", i === 0 && s.games > 0 && "bg-amber/12")}>
              <span className={cn("font-heading font-extrabold text-2xl", i === 0 && s.games > 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
              <span className="font-display font-extrabold text-[26px] leading-none uppercase truncate">{name(s.userId)}</span>
              <span className="text-right font-heading font-extrabold text-2xl tabular-nums">
                {s.wins}–{s.losses}
              </span>
              <span className={cn("text-right font-heading font-extrabold text-[22px] tabular-nums", s.elo > 0 ? "text-mint" : s.elo < 0 ? "text-red-pale" : "text-muted")}>
                {s.elo > 0 ? "+" : ""}
                {s.elo}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
