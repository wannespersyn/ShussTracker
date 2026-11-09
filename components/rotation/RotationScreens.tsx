/**
 * Rotation screens
 *
 * The Americano / Mexicano page sections from the "Shussapp Americano"
 * design: header, round progress, tabs, Live (mats, sit-outs, queue, top 3),
 * Standings (podium + table), Rounds (results per round) and the end screen
 * (champion, awards, final table). Server components; data from
 * lib/db/rotations + lib/rotation-view.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { RotationView } from "@/lib/db/rotations";
import type { RotationStanding } from "@/lib/rotation";
import { formOf, matsNow, rotationAwards, rotationProgress, type RotationAward } from "@/lib/rotation-view";
import { cn } from "@/lib/cn";
import { format, type Dictionary } from "@/lib/i18n";

type R = Dictionary["rot"];
type Names = (id: string) => string;
export type RotationTab = "live" | "standings" | "rounds";

const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted";
const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function RotationHeader({ v, R, backHref, backLabel, tvHref }: Readonly<{ v: RotationView; R: R; backHref: string; backLabel: string; tvHref?: string }>) {
  const live = v.status !== "completed";
  return (
    <header className="flex items-center gap-3 h-11">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="flex-1 min-w-0 flex flex-col">
        <h1 className="font-display font-extrabold text-[22px] leading-[1.05] uppercase truncate">{v.name}</h1>
        <span className="font-body text-xs text-muted truncate">
          {format(R.meta, { mode: v.mode === "americano" ? R.americano : R.mexicano, n: v.players.length, m: v.mats })}
        </span>
      </span>
      {tvHref && (
        <Link href={tvHref} aria-label={R.tv} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="12" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </Link>
      )}
      {live ? (
        <span className="flex items-center gap-1.5 px-2.5 py-1.25 rounded-sm bg-red text-ink font-heading font-extrabold text-[13px] tracking-[0.12em]">
          <span className="w-1.75 h-1.75 rounded-pill bg-ink" />
          {R.live}
        </span>
      ) : (
        <span className="px-2.5 py-1.25 rounded-sm bg-surface-raised text-muted font-heading font-extrabold text-[13px] tracking-[0.12em]">{R.done}</span>
      )}
    </header>
  );
}

export function RoundProgress({ v, R, big = false }: Readonly<{ v: RotationView; R: R; big?: boolean }>) {
  const p = rotationProgress(v);
  return (
    <section aria-label={format(R.roundOf, { n: p.current })} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className={cn("font-display font-extrabold leading-[0.9]", big ? "text-[40px]" : "text-[44px]")}>
          {format(R.roundOf, { n: p.current })}
          <span className="text-[#5b6460]"> / {p.rounds}</span>
        </span>
        <span className={cn("font-heading font-bold tracking-[0.06em] text-muted", big ? "text-lg" : "text-sm")}>{format(R.gamesOf, { p: p.played, t: p.total })}</span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${p.rounds}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: p.rounds }, (_, i) => {
          const r = i + 1;
          const share = r < p.current ? 1 : r === p.current ? p.roundShare : 0;
          return (
            <span
              key={r}
              className={cn("rounded-[3px]", big ? "h-2" : "h-1.5")}
              style={{ background: share >= 1 ? "var(--color-gold)" : share > 0 ? `linear-gradient(90deg, var(--color-gold) 0 ${Math.round(share * 100)}%, var(--color-chip) ${Math.round(share * 100)}%)` : "var(--color-chip)" }}
            />
          );
        })}
      </div>
    </section>
  );
}

export function RotationTabs({ base, tab, R }: Readonly<{ base: string; tab: RotationTab; R: R }>) {
  const tabs: [RotationTab, string][] = [
    ["live", R.tabLive],
    ["standings", R.tabStandings],
    ["rounds", R.tabRounds],
  ];
  return (
    <nav aria-label={R.tabLive} className="grid grid-cols-3 gap-1 p-1 rounded-[14px] bg-surface-deep border border-line">
      {tabs.map(([id, label]) => (
        <Link
          key={id}
          href={id === "live" ? base : `${base}?tab=${id}`}
          aria-current={tab === id ? "page" : undefined}
          className={cn(
            "h-10 rounded-[10px] flex items-center justify-center font-heading font-extrabold text-[15px] tracking-[0.08em]",
            tab === id ? "bg-amber text-ink" : "text-muted",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function DuoAvatars({ names, size = 36 }: Readonly<{ names: string[]; size?: number }>) {
  return (
    <span className="flex shrink-0">
      {names.map((n, i) => (
        <span
          key={i}
          className={cn("rounded-pill border-[3px] border-surface-deep flex items-center justify-center font-display font-extrabold text-[13px]", i === 0 ? "bg-chip" : "bg-[#343b3e] -ml-3")}
          style={{ width: size, height: size }}
        >
          {initials(n)}
        </span>
      ))}
    </span>
  );
}

export function LiveTab({ v, R, name, base, userId }: Readonly<{ v: RotationView; R: R; name: Names; base: string; userId: string }>) {
  const { now, queue } = matsNow(v);
  const p = rotationProgress(v);
  const rest = v.byes[p.current] ?? [];
  const waitingNext = v.mode === "mexicano" && now.length === 0 && v.plannedRounds < v.rounds;
  const nextRound = queue[0]?.round;
  return (
    <>
      {now.length > 0 && (
        <section aria-label={R.onMat} className="flex flex-col gap-3">
          <span className={kicker}>{R.onMat}</span>
          {now.map((g, i) => (
            <article key={g.id} className="rounded-[20px] bg-surface-deep border border-gold/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber/10 border-b border-gold/20">
                <span className="font-heading font-extrabold text-[15px] tracking-[0.14em] text-gold">{format(R.mat, { n: i + 1 })}</span>
                <span className="font-body text-xs text-soft">{format(R.round, { n: g.round })}{g.firstTimeA && g.firstTimeB ? ` · ${R.firstTogether}` : ""}</span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-3.5">
                {(
                  [
                    [g.a, g.aElo],
                    [g.b, g.bElo],
                  ] as const
                ).map(([ids, elo], k) => (
                  <div key={k} className="contents">
                    {k === 1 && (
                      <div className="flex items-center gap-2.5 pl-1">
                        <span className="h-px flex-1 bg-line" />
                        <span className="font-heading font-extrabold text-[13px] tracking-[0.16em] text-muted">{R.vs}</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <DuoAvatars names={ids.map(name)} />
                      <span className={cn("flex-1 min-w-0 truncate font-display font-extrabold text-2xl leading-none uppercase", ids.includes(userId) && "text-gold")}>
                        {ids.map(name).join(" & ")}
                      </span>
                      <span className="font-heading font-bold text-[13px] text-muted tabular-nums">{elo}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4">
                <Link
                  href={`${base}/game/${g.id}`}
                  className="h-12.5 rounded-[14px] bg-amber text-ink flex items-center justify-center gap-2 font-heading font-extrabold text-lg tracking-[0.06em]"
                >
                  {R.logResult}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
      {waitingNext && <p className="font-body text-sm text-muted">{format(R.waitingRound, { n: v.plannedRounds + 1 })}</p>}

      {rest.length > 0 && now.length > 0 && (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-surface-deep border border-dashed border-cream/18">
          <span className="flex">
            {rest.map((id, i) => (
              <span key={id} className={cn("w-9 h-9 rounded-pill bg-chip text-muted border-[3px] border-surface-deep flex items-center justify-center font-display font-extrabold text-[13px]", i > 0 && "-ml-3")}>
                {initials(name(id))}
              </span>
            ))}
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className={kicker}>{R.restNow}</span>
            <span className="font-body font-semibold text-[15px] truncate">{format(R.restBack, { name: rest.map(name).join(", ") })}</span>
          </span>
        </div>
      )}

      {queue.length > 0 && (
        <section aria-label={R.nextShort} className="flex flex-col gap-2">
          <span className={kicker}>{nextRound ? format(R.next, { n: nextRound }) : R.nextShort}</span>
          {queue.slice(0, 4).map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] bg-surface-deep border border-line">
              <span className="flex-1 min-w-0 truncate font-body font-semibold text-sm text-soft">{g.a.map(name).join(" & ")}</span>
              <span className="font-heading font-extrabold text-[12px] tracking-[0.14em] text-[#5b6460]">{R.vs}</span>
              <span className="flex-1 min-w-0 truncate text-right font-body font-semibold text-sm text-soft">{g.b.map(name).join(" & ")}</span>
            </div>
          ))}
        </section>
      )}

      <section aria-label={R.standingsTop} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className={kicker}>{R.standingsTop}</span>
          <Link href={`${base}?tab=standings`} className="py-2 font-heading font-bold text-[13px] tracking-[0.1em] text-gold">
            {R.seeAll}
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {v.standings.slice(0, 3).map((s, i) => (
            <div key={s.userId} className={cn("flex flex-col gap-1 p-3 rounded-[14px]", i === 0 && s.games > 0 ? "bg-amber text-ink" : "bg-surface-deep border border-line")}>
              <span className="font-heading font-extrabold text-[13px] tracking-[0.1em]">#{i + 1}</span>
              <span className="font-display font-extrabold text-2xl leading-none uppercase truncate">{name(s.userId)}</span>
              <span className="font-heading font-bold text-[15px] tabular-nums">
                {s.wins}–{s.losses}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function Podium({ top, name }: Readonly<{ top: RotationStanding[]; name: Names }>) {
  if (top.length < 3 || top[0].games === 0) return null;
  const order = [top[1], top[0], top[2]];
  const ring = ["var(--color-soft)", "var(--color-gold)", "var(--color-gold-end)"];
  const height = [76, 104, 56];
  return (
    <section aria-label="Podium" className="grid grid-cols-3 gap-2 items-end">
      {order.map((s, i) => {
        const first = i === 1;
        return (
          <div key={s.userId} className="flex flex-col items-center gap-1.5">
            {first && (
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" className="fill-gold">
                <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
              </svg>
            )}
            <span
              className={cn("rounded-pill flex items-center justify-center font-display font-extrabold", first ? "w-15 h-15 text-xl bg-amber text-ink" : "w-13 h-13 text-lg bg-chip")}
              style={{ boxShadow: `0 0 0 3px var(--color-surface), 0 0 0 5px ${ring[i]}` }}
            >
              {initials(name(s.userId))}
            </span>
            <span className={cn("font-display font-extrabold uppercase truncate max-w-full", first ? "text-[22px]" : "text-xl")}>{name(s.userId)}</span>
            <div
              className={cn("w-full rounded-[12px_12px_4px_4px] flex flex-col items-center justify-center", first ? "bg-amber text-ink" : "bg-surface-raised")}
              style={{ height: height[i] }}
            >
              <span className={cn("font-display font-extrabold leading-none", first ? "text-[40px]" : "text-3xl text-soft")}>{first ? 1 : i === 0 ? 2 : 3}</span>
              <span className={cn("font-heading font-bold text-sm tabular-nums", first ? "" : "text-muted")}>
                {s.wins}–{s.losses}
                {first && s.elo !== 0 ? ` · ${s.elo > 0 ? "+" : ""}${s.elo}` : ""}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function StandingsTable({ v, R, name, userId }: Readonly<{ v: RotationView; R: R; name: Names; userId: string }>) {
  const form = formOf(v);
  const cols = "grid grid-cols-[26px_minmax(0,1fr)_44px_36px_38px_44px] gap-2 items-center";
  return (
    <section aria-label={R.tabStandings} className="rounded-[18px] bg-surface-deep border border-line overflow-hidden">
      <div className={cn(cols, "px-3.5 py-2.5 font-heading font-bold text-[11px] tracking-[0.12em] text-muted")}>
        <span>#</span>
        <span>{R.colPlayer}</span>
        <span className="text-right">{R.colWL}</span>
        <span className="text-right">{R.colPct}</span>
        <span className="text-right">{R.colMama}</span>
        <span className="text-right">{R.colElo}</span>
      </div>
      {v.standings.map((s, i) => {
        const f = (form[s.userId] ?? []).slice(-5);
        return (
          <div key={s.userId} className={cn(cols, "px-3.5 py-2.75 border-t border-cream/6", s.userId === userId && "bg-amber/8")}>
            <span className={cn("font-heading font-extrabold text-[17px]", i === 0 && s.games > 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
            <span className="min-w-0 flex flex-col gap-0.75">
              <span className="font-body font-semibold text-[15px] truncate">{s.userId === userId ? format(R.you, { name: name(s.userId) }) : name(s.userId)}</span>
              <span className="flex gap-0.75" aria-hidden="true">
                {f.map((x, k) => (
                  <span key={k} className={cn("w-3.5 h-1.25 rounded-[2px]", x === "W" ? "bg-gold" : "bg-[#3a4245]")} />
                ))}
              </span>
            </span>
            <span className="text-right font-heading font-extrabold text-[17px] tabular-nums">
              {s.wins}–{s.losses}
            </span>
            <span className="text-right font-body text-sm text-soft tabular-nums">{s.games ? s.winPct : "—"}</span>
            <span className={cn("text-right font-heading font-extrabold text-[17px] tabular-nums", s.mama > 0 ? "text-red" : "text-[#5b6460]")}>{s.mama}</span>
            <span className={cn("text-right font-heading font-extrabold text-base tabular-nums", s.elo > 0 ? "text-mint" : s.elo < 0 ? "text-red-pale" : "text-muted")}>
              {s.elo > 0 ? "+" : ""}
              {s.elo}
            </span>
          </div>
        );
      })}
    </section>
  );
}

export function RoundsTab({ v, R, name, finishSlot }: Readonly<{ v: RotationView; R: R; name: Names; finishSlot?: ReactNode }>) {
  const p = rotationProgress(v);
  const rounds = Array.from({ length: v.plannedRounds }, (_, i) => i + 1)
    .filter((r) => v.games.some((g) => g.round === r && (g.played || r === p.current)))
    .reverse();
  const left = v.status === "completed" ? 0 : v.rounds - p.current;
  const chip = (kind: "W" | "L" | "-") =>
    cn(
      "w-5.5 h-5.5 shrink-0 rounded-[6px] flex items-center justify-center font-heading font-extrabold text-[12px]",
      kind === "W" ? "bg-amber text-ink" : kind === "L" ? "bg-chip text-muted" : "border border-line-strong",
    );
  return (
    <>
      {rounds.map((r) => {
        const live = r === p.current && v.status !== "completed" && v.games.some((g) => g.round === r && !g.played);
        const list = v.games.filter((g) => g.round === r);
        const rest = v.byes[r] ?? [];
        return (
          <section key={r} aria-label={format(R.round, { n: r })} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <span className="font-heading font-extrabold text-xl tracking-[0.04em]">{format(R.round, { n: r })}</span>
              <span className={cn("px-2 py-0.75 rounded-[6px] font-heading font-extrabold text-[12px] tracking-[0.12em]", live ? "bg-red/16 text-red-pale" : "bg-surface-raised text-muted")}>
                {live ? R.busy : R.finished}
              </span>
              <span className="flex-1 h-px bg-line" />
            </div>
            {list.map((g, i) => {
              const res = g.played ? g.aWon : null;
              const side = (ids: readonly string[], won: boolean | null, kruip: boolean | undefined) => {
                const mama = ids.reduce((s, id) => s + (g.mama?.[id] ?? 0), 0);
                const extra = [mama > 0 ? format(R.mamaN, { n: mama }) : null, won === false && kruip ? R.kruiped : null].filter(Boolean).join(" · ");
                return (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={chip(won === null ? "-" : won ? "W" : "L")}>{won === null ? "" : won ? R.won : R.lost}</span>
                    <span className={cn("truncate text-[15px]", won === false ? "font-medium text-muted" : "font-bold text-cream")}>{ids.map(name).join(" & ")}</span>
                    {extra && <span className="shrink-0 font-body text-xs font-semibold text-red-pale">{extra}</span>}
                  </span>
                );
              };
              const body = (
                <>
                  <span className="w-10.5 font-heading font-bold text-[12px] tracking-[0.14em] text-muted">{format(R.mat, { n: i + 1 })}</span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                    {side(g.a, res, g.kruipA)}
                    {side(g.b, res === null ? null : !res, g.kruipB)}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="text-[#5b6460]">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </>
              );
              const cls = cn("flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-surface-deep border text-cream", g.played ? "border-line" : "border-gold/40");
              return g.gameId ? (
                <Link key={g.id} href={`/game/${g.gameId}`} className={cls}>
                  {body}
                </Link>
              ) : (
                <div key={g.id} className={cls}>
                  {body}
                </div>
              );
            })}
            {rest.length > 0 && <span className="font-body text-[13px] text-muted">{format(R.rest, { names: rest.map(name).join(", ") })}</span>}
          </section>
        );
      })}
      {left > 0 && (
        <div className="flex items-center justify-center px-3.5 py-3.5 rounded-[14px] border border-dashed border-cream/18 font-body text-sm text-muted">
          {format(R.plannedLeft, { r: left, g: left * Math.floor(v.players.length / 4) })}
        </div>
      )}
      {finishSlot}
    </>
  );
}

const AWARD_ICON: Record<RotationAward["kind"], { path: string; tone: string }> = {
  mama: { path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", tone: "bg-red/16 text-red-pale" },
  kruip: { path: "M4 18h16M6 18l2-6h8l2 6M9 12V8a3 3 0 0 1 6 0v4", tone: "bg-surface-raised text-soft" },
  riser: { path: "M4 17l6-6 4 4 6-6M14 9h6v6", tone: "bg-mint/14 text-mint" },
  mamaGame: { path: "M13 2L4 14h7l-1 8 9-12h-7z", tone: "bg-amber/14 text-gold" },
};

export function FinalView({ v, R, name, userId, actions }: Readonly<{ v: RotationView; R: R; name: Names; userId: string; actions: ReactNode }>) {
  const champ = v.standings.find((s) => s.games > 0);
  const awards = rotationAwards(v);
  const label: Record<RotationAward["kind"], [string, string]> = {
    mama: [R.awMama, R.awMamaV],
    kruip: [R.awKruip, R.awKruipV],
    riser: [R.awRiser, R.awRiserV],
    mamaGame: [R.awMamaGame, R.awMamaGameV],
  };
  const medal = ["text-gold", "text-soft", "text-gold-end"];
  return (
    <>
      {champ && (
        <section aria-label={R.champion} className="relative rounded-[22px] bg-amber text-ink px-5 pt-5.5 pb-5 flex flex-col gap-1.5 overflow-hidden">
          <svg width="150" height="150" viewBox="0 0 24 24" aria-hidden="true" className="absolute -right-6 -top-4.5 fill-ink/8">
            <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
          </svg>
          <span className="font-heading font-extrabold text-[13px] tracking-[0.2em]">{R.champion}</span>
          <span className="font-display font-extrabold text-[76px] leading-[0.85] uppercase truncate">{name(champ.userId)}</span>
          <div className="flex gap-4.5 mt-2">
            {(
              [
                [`${champ.wins}–${champ.losses}`, R.cWL],
                [`${champ.winPct}%`, R.cWin],
                [`${champ.elo > 0 ? "+" : ""}${champ.elo}`, R.cElo],
                [String(champ.partners), R.cPartners],
              ] as const
            ).map(([val, k]) => (
              <span key={k} className="flex flex-col">
                <span className="font-display font-extrabold text-[28px] leading-none tabular-nums">{val}</span>
                <span className="font-heading font-bold text-[11px] tracking-[0.14em]">{k}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {v.standings.slice(1, 3).map((s, i) => (
          <div key={s.userId} className="flex items-center gap-2.5 p-3 rounded-[14px] bg-surface-deep border border-line">
            <span className={cn("font-display font-extrabold text-[26px]", i === 0 ? "text-soft" : "text-gold-end")}>{i + 2}</span>
            <span className="min-w-0 flex flex-col">
              <span className="font-display font-extrabold text-xl leading-none uppercase truncate">{name(s.userId)}</span>
              <span className="font-body text-xs text-muted">
                {s.wins}–{s.losses} · {s.winPct}%
              </span>
            </span>
          </div>
        ))}
      </div>

      {awards.length > 0 && (
        <section aria-label={R.awards} className="flex flex-col gap-2">
          <span className={kicker}>{R.awards}</span>
          <div className="grid grid-cols-2 gap-2">
            {awards.map((a) => (
              <div key={a.kind} className="flex flex-col gap-1.5 p-3.5 rounded-[16px] bg-surface-deep border border-line">
                <span className={cn("w-8.5 h-8.5 rounded-[10px] flex items-center justify-center", AWARD_ICON[a.kind].tone)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d={AWARD_ICON[a.kind].path} />
                  </svg>
                </span>
                <span className="font-heading font-bold text-[12px] tracking-[0.12em] text-muted">{label[a.kind][0]}</span>
                <span className="font-display font-extrabold text-[22px] leading-none uppercase truncate">{name(a.userId)}</span>
                <span className="font-body text-[13px] text-soft">{format(label[a.kind][1], { n: a.value, r: a.round ?? 0 })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label={R.finalTable} className="rounded-[18px] bg-surface-deep border border-line overflow-hidden">
        <div className={cn(kicker, "px-3.5 pt-3 pb-1.5")}>{R.finalTable}</div>
        {v.standings.map((s, i) => (
          <div key={s.userId} className={cn("grid grid-cols-[24px_minmax(0,1fr)_44px_40px] gap-2 items-center px-3.5 py-2.25 border-t border-cream/6", s.userId === userId && "bg-amber/8")}>
            <span className={cn("font-heading font-extrabold text-[17px]", medal[i] ?? "text-muted")}>{i + 1}</span>
            <span className="font-body font-semibold text-[15px] truncate">{s.userId === userId ? format(R.you, { name: name(s.userId) }) : name(s.userId)}</span>
            <span className="text-right font-heading font-extrabold text-[17px] tabular-nums">
              {s.wins}–{s.losses}
            </span>
            <span className="text-right font-body text-sm text-soft tabular-nums">{s.games ? `${s.winPct}%` : "—"}</span>
          </div>
        ))}
      </section>

      {actions}
    </>
  );
}
