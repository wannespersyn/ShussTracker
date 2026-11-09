/**
 * Americano / Mexicano page — Route: /americano/[rotationId]
 *
 * The live night: champion (when done), games on the mats right now with a
 * play button, the queue, the individual standings and every round with
 * results and who sat out. Requires crew membership.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getRotation, type RotationGameView } from "@/lib/db/rotations";
import { onTheMats } from "@/lib/rotation";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";
import { Kicker, Screen } from "@/components/v2";
import { ConfirmForm } from "@/components/ui";
import { finishRotationAction } from "../actions";

export default async function RotationPage({ params }: Readonly<{ params: Promise<{ rotationId: string }> }>) {
  const { rotationId } = await params;
  const session = await requireSession();
  const userId = session.user.id;
  const rotation = await getRotation(rotationId);
  if (!rotation) notFound();
  try {
    await requireGroupMember(userId, rotation.groupId);
  } catch {
    notFound();
  }
  const [t, crew] = await Promise.all([getT(), db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { createdBy: true, name: true } })]);
  const R = t.rot;
  const nameOf = new Map(rotation.players.map((p) => [p.id, firstName(p.name)]));
  const nm = (id: string) => nameOf.get(id) ?? t.more.player;
  const duo = (ids: readonly string[]) => ids.map(nm).join(" & ");

  const live = rotation.status !== "completed";
  const { now, queue } = onTheMats(rotation.games, rotation.mats);
  const mayFinish = live && (rotation.createdBy === userId || crew?.createdBy === userId);
  const champion = !live ? rotation.standings.find((s) => s.games > 0) : undefined;
  const waitingNext = live && rotation.mode === "mexicano" && now.length === 0 && rotation.plannedRounds < rotation.rounds;
  const rounds = Array.from({ length: rotation.plannedRounds }, (_, i) => i + 1).reverse();

  return (
    <Screen className="gap-4">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/crews/${rotation.groupId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 min-w-0 flex flex-col">
          <h1 className="font-display font-extrabold text-[22px] tracking-[0.04em] uppercase truncate">{rotation.name}</h1>
          <span className="font-body text-xs text-muted truncate">
            {format(R.meta, { mode: rotation.mode === "americano" ? R.americano : R.mexicano, n: rotation.players.length, m: rotation.mats })}
          </span>
        </span>
        <span className={cn("px-2.5 py-1.25 rounded-sm font-heading font-extrabold text-[13px] tracking-[0.12em]", live ? "bg-red text-ink" : "bg-surface-raised text-muted")}>
          {live ? R.live : R.done}
        </span>
      </header>

      {champion && (
        <section className="rounded-[18px] bg-amber text-ink px-4.5 py-4 flex items-center gap-3.5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
          </svg>
          <span className="flex flex-col">
            <span className="font-heading font-bold text-[12px] tracking-[0.16em]">{R.champion}</span>
            <span className="font-display font-extrabold text-[30px] leading-none uppercase">{nm(champion.userId)}</span>
            <span className="font-body text-xs font-semibold">
              {champion.wins}–{champion.losses} · {champion.winPct}%
            </span>
          </span>
        </section>
      )}

      {live && now.length > 0 && (
        <section aria-label={R.onMat} className="flex flex-col gap-2">
          <Kicker>{R.onMat}</Kicker>
          {now.map((g, i) => (
            <GameCard key={g.id} g={g} duo={duo} label={`${format(R.mat, { n: i + 1 })} · ${format(R.round, { n: g.round })}`} vs={R.vs}>
              <Link
                href={`/americano/${rotation.id}/game/${g.id}`}
                className="h-11 px-4 rounded-pill bg-amber text-ink flex items-center font-heading font-extrabold text-[15px] tracking-[0.08em]"
              >
                {R.play}
              </Link>
            </GameCard>
          ))}
        </section>
      )}
      {waitingNext && <p className="font-body text-sm text-muted">{format(R.waitingRound, { n: rotation.plannedRounds + 1 })}</p>}

      <section aria-label={R.standings} className="flex flex-col gap-1.5">
        <Kicker>{R.standings}</Kicker>
        <div className="rounded-[16px] bg-surface-deep border border-line overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_52px_40px_44px_48px] gap-2 px-3.5 py-2 font-heading font-semibold text-[11px] tracking-[0.12em] uppercase text-muted">
            <span>#</span>
            <span>{R.colPlayer}</span>
            <span className="text-right">{R.colWL}</span>
            <span className="text-right">{R.colPct}</span>
            <span className="text-right">{R.colMama}</span>
            <span className="text-right">{R.colElo}</span>
          </div>
          {rotation.standings.map((s, i) => (
            <div
              key={s.userId}
              className={cn(
                "grid grid-cols-[24px_1fr_52px_40px_44px_48px] gap-2 items-center px-3.5 py-2.5 border-t border-cream/6",
                s.userId === userId && "bg-amber/8",
              )}
            >
              <span className={cn("font-heading font-bold text-[15px]", i === 0 && s.games > 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
              <span className="font-body font-semibold text-sm truncate">{nm(s.userId)}</span>
              <span className="text-right font-heading font-bold text-[15px] tabular-nums">
                {s.wins}–{s.losses}
              </span>
              <span className="text-right font-body text-sm text-soft tabular-nums">{s.games ? s.winPct : "—"}</span>
              <span className={cn("text-right font-heading font-bold text-[15px] tabular-nums", s.mama > 0 ? "text-red" : "text-muted")}>{s.mama}</span>
              <span className={cn("text-right font-heading font-bold text-[15px] tabular-nums", s.elo > 0 ? "text-mint" : s.elo < 0 ? "text-red-pale" : "text-muted")}>
                {s.elo > 0 ? "+" : ""}
                {s.elo}
              </span>
            </div>
          ))}
        </div>
      </section>

      {live && queue.length > 0 && (
        <section aria-label={R.queue} className="flex flex-col gap-2">
          <Kicker>{R.queue}</Kicker>
          {queue.slice(0, 6).map((g) => (
            <GameCard key={g.id} g={g} duo={duo} label={format(R.round, { n: g.round })} vs={R.vs} dim />
          ))}
        </section>
      )}

      {rounds.map((r) => {
        const list = rotation.games.filter((g) => g.round === r && g.played);
        if (list.length === 0) return null;
        const byes = rotation.byes[r] ?? [];
        return (
          <section key={r} aria-label={format(R.round, { n: r })} className="flex flex-col gap-1.5">
            <Kicker>{format(R.round, { n: r })}</Kicker>
            {list.map((g) => (
              <Link
                key={g.id}
                href={g.gameId ? `/game/${g.gameId}` : "#"}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line text-cream"
              >
                <span className={cn("flex-1 min-w-0 font-body text-sm truncate", g.aWon ? "font-bold text-cream" : "text-muted")}>{duo(g.a)}</span>
                <span className="font-heading font-bold text-[12px] tracking-[0.1em] uppercase text-muted">{R.vs}</span>
                <span className={cn("flex-1 min-w-0 text-right font-body text-sm truncate", g.aWon === false ? "font-bold text-cream" : "text-muted")}>{duo(g.b)}</span>
              </Link>
            ))}
            {byes.length > 0 && <span className="font-body text-xs text-muted">{format(R.rest, { names: byes.map(nm).join(", ") })}</span>}
          </section>
        );
      })}

      {mayFinish && (
        <div className="flex justify-center pt-2">
          <ConfirmForm action={finishRotationAction.bind(null, rotation.id)} confirmMessage={R.finishConfirm}>
            <button type="submit" className="h-9 px-4 rounded-pill border border-red-pale/40 text-red-pale font-heading font-bold text-sm tracking-[0.08em] uppercase">
              {R.finish}
            </button>
          </ConfirmForm>
        </div>
      )}
    </Screen>
  );
}

function GameCard({
  g,
  duo,
  label,
  vs,
  dim = false,
  children,
}: Readonly<{ g: RotationGameView; duo: (ids: readonly string[]) => string; label: string; vs: string; dim?: boolean; children?: React.ReactNode }>) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5 py-3 rounded-[16px] border", dim ? "bg-surface-deep/60 border-line" : "bg-surface-deep border-gold/40")}>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-heading font-semibold text-[11px] tracking-[0.14em] uppercase text-muted">{label}</span>
        <span className="font-heading font-bold text-[17px] truncate">{duo(g.a)}</span>
        <span className="font-body text-xs text-muted">
          {vs} <span className="font-heading font-bold text-[15px] text-soft">{duo(g.b)}</span>
        </span>
      </span>
      {children}
    </div>
  );
}
