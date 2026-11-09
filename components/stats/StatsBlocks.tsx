/**
 * StatsBlocks
 *
 * One stats block of the player-built stats page, in its size (S = half
 * width, M = full width, L = full width with more): Elo chart, win %,
 * mamas, kruipen, nights, partners, rivals and crew boards.
 *
 * Data: a StatsScope (lib/stats-scope.ts) computed once per crew/player/period.
 * Notes: copy lives in t.sb; block kinds and sizes in lib/stats-layout.ts.
 */
"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { StatsGame, StatsEloPoint } from "@/lib/db/stats";
import { ELO_BASE } from "@/lib/elo";
import type { StatsBlock } from "@/lib/stats-layout";
import type { StatsScope } from "@/lib/stats-scope";
import { cn } from "@/lib/cn";
import { format, type Dictionary } from "@/lib/i18n";

export type BlockCtx = {
  sb: Dictionary["sb"];
  name: (id: string) => string;
  playerId: string;
  isMe: boolean;
  crewName: string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
};

const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted uppercase";
const big = "font-display font-extrabold leading-[0.9]";
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const tone = (n: number) => (n > 0 ? "text-mint" : n < 0 ? "text-red-pale" : "text-muted");
const initials = (n: string) => n.slice(0, 2).toUpperCase();

export function blockTitle(sb: Dictionary["sb"], kind: StatsBlock["kind"]) {
  return sb.b[kind];
}

/** Card shell shared by every block (and by the editor's dashed version). */
export function BlockCard({ size, children, className, label }: Readonly<{ size: StatsBlock["size"]; children: ReactNode; className?: string; label: string }>) {
  return (
    <section
      aria-label={label}
      className={cn(
        "flex flex-col gap-2 p-3.5 rounded-[18px] bg-surface-deep border border-line min-w-0",
        size === "S" ? "col-span-1 min-h-35 justify-between" : "col-span-2",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Rows({ rows, name, highlight, unit }: Readonly<{ rows: { id: string; v: number }[]; name: (id: string) => string; highlight: string; unit?: (v: number) => string }>) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[20px_76px_minmax(0,1fr)_40px] gap-2.5 items-center h-7.5">
          <span className={cn("font-heading font-extrabold text-base", i === 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
          <span className={cn("truncate font-body text-sm", r.id === highlight ? "font-bold text-gold" : "font-semibold")}>{name(r.id)}</span>
          <span className="h-2.5 rounded-[5px] bg-chip overflow-hidden">
            <span className={cn("block h-full rounded-[5px]", i === 0 ? "bg-red" : "bg-[#6b746f]")} style={{ width: `${Math.round((r.v / max) * 100)}%` }} />
          </span>
          <span className="text-right font-heading font-extrabold text-lg tabular-nums">{unit ? unit(r.v) : r.v}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsBlockView({ block, s, ctx }: Readonly<{ block: StatsBlock; s: StatsScope; ctx: BlockCtx }>) {
  const { sb, name } = ctx;
  const title = blockTitle(sb, block.kind);
  const size = block.size;
  const empty = s.mine.length === 0;
  const head = <span className={kicker}>{title}</span>;
  const none = <span className="font-body text-[13px] text-muted">{sb.noGames}</span>;

  switch (block.kind) {
    case "elo":
      return <EloBlock s={s} ctx={ctx} size={size} title={title} />;

    case "winPct": {
      const dash = (s.winPct / 100) * 94.2;
      return (
        <BlockCard size={size} label={title}>
          {head}
          {empty ? none : (
            <div className="flex items-center gap-3">
              <svg width={size === "S" ? 58 : 72} height={size === "S" ? 58 : 72} viewBox="0 0 36 36" role="img" aria-label={`${s.winPct}%`}>
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-chip)" strokeWidth="5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-gold)" strokeWidth="5" strokeDasharray={`${dash} 94.2`} strokeLinecap="round" transform="rotate(-90 18 18)" />
              </svg>
              <span className="flex flex-col">
                <span className={cn(big, "text-[34px]")}>{s.winPct}%</span>
                <span className="font-body text-xs text-muted">
                  {s.wins}
                  {sb.won} · {s.losses}
                  {sb.lost}
                </span>
              </span>
            </div>
          )}
        </BlockCard>
      );
    }

    case "games":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className={cn(big, "text-[52px]")}>{s.mine.length}</span>
          <span className="font-body text-xs text-muted">
            {s.wins}
            {sb.won} · {s.losses}
            {sb.lost}
          </span>
        </BlockCard>
      );

    case "streak":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className="flex items-baseline gap-2">
            <span className={cn(big, "text-[52px]", s.streak.current >= 3 && "text-gold")}>{s.streak.current}</span>
            <span className="font-body text-xs text-muted">{sb.current}</span>
          </span>
          <span className="font-body text-xs text-muted">{format(sb.longest, { n: s.streak.best })}</span>
        </BlockCard>
      );

    case "kruipen":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className={cn(big, "text-[52px]")}>{s.kruipen}</span>
          <span className="font-body text-xs text-muted">{s.kruipen > 0 && s.kruipRank > 0 ? format(sb.rankInCrew, { n: s.kruipRank }) : sb.noKruip}</span>
        </BlockCard>
      );

    case "mamas":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className={cn(big, "text-[52px] text-red")}>{s.mamas}</span>
          <span className="font-body text-xs text-muted">{format(sb.perGame, { v: s.mamaPerGame.toFixed(2) })}</span>
        </BlockCard>
      );

    case "mamaRate":
      return (
        <BlockCard size={size} label={title}>
          {head}
          {empty ? none : (
            <>
              <div className={cn("flex gap-2.5", size === "S" ? "flex-col" : "items-baseline")}>
                <span className={cn(big, size === "S" ? "text-[44px]" : "text-[56px]", "text-red")}>{s.mamaRate}%</span>
                <span className="font-body text-sm text-soft">{sb.ofGames}</span>
              </div>
              {size !== "S" && (
                <>
                  <div className="h-2.5 rounded-[5px] bg-chip overflow-hidden">
                    <div className="h-full bg-red" style={{ width: `${s.mamaRate}%` }} />
                  </div>
                  <div className="flex justify-between font-body font-semibold text-xs text-soft">
                    <span>{format(sb.perGame, { v: s.mamaPerGame.toFixed(2) })}</span>
                    <span className="text-muted">{format(sb.crewAvg, { crew: ctx.crewName, v: s.crewMamaPerGame.toFixed(2) })}</span>
                  </div>
                </>
              )}
            </>
          )}
        </BlockCard>
      );

    case "bestGame":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className={cn(big, "text-[52px]")}>{s.bestGame?.n ?? 0}</span>
          <span className="font-body text-xs text-muted">
            {s.bestGame
              ? s.bestGame.partners.length
                ? format(sb.mamaWithP, { d: ctx.date(s.bestGame.at), p: s.bestGame.partners.map(name).join(" & ") })
                : format(sb.mamaWith, { d: ctx.date(s.bestGame.at) })
              : "—"}
          </span>
        </BlockCard>
      );

    case "mamaStreak":
      return (
        <BlockCard size={size} label={title}>
          {head}
          <span className={cn(big, "text-[52px]")}>{s.mamaStreak}</span>
          <span className="font-body text-xs text-muted">{sb.nightsRow}</span>
        </BlockCard>
      );

    case "form": {
      const list = s.nights.slice(0, size === "L" ? 8 : 5).reverse();
      const max = Math.max(1, ...list.map((n) => Math.abs(n.elo)));
      return (
        <BlockCard size={size} label={title}>
          <div className="flex items-baseline justify-between">
            {head}
            <span className="font-body text-xs text-muted">Elo ±</span>
          </div>
          {list.length === 0 ? none : (
            <>
              <div className="grid gap-1.5 items-end" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))`, height: size === "L" ? 140 : 96 }}>
                {list.map((n) => (
                  <div key={n.key} className="h-full flex flex-col items-center justify-end gap-1">
                    <span className={cn("font-heading font-extrabold text-sm", tone(n.elo))}>{signed(n.elo)}</span>
                    <span
                      className={cn("w-full rounded-[6px_6px_2px_2px]", n.elo > 0 ? "bg-gold" : "bg-[#3a4245]")}
                      style={{ height: Math.max(8, Math.round((Math.abs(n.elo) / max) * (size === "L" ? 100 : 62))) }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
                {list.map((n) => (
                  <span key={n.key} className="flex flex-col items-center gap-px">
                    <span className="font-body font-semibold text-xs whitespace-nowrap">
                      {ctx.date(n.at)}
                      {n.form && <span title={n.form === "hot" ? sb.hot : sb.cold}>{n.form === "hot" ? " 🔥" : " 🥶"}</span>}
                    </span>
                    <span className="font-body text-[11px] text-muted">
                      {n.w}–{n.n - n.w}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </BlockCard>
      );
    }

    case "nights":
      return (
        <BlockCard size={size} label={title}>
          {head}
          {s.nights.length === 0 && none}
          {s.nights.slice(0, size === "L" ? 10 : 4).map((n) => (
            <div key={n.key} className="flex items-center gap-3 py-1.5 border-t border-cream/6 first-of-type:border-0">
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-body font-semibold text-sm">
                  {ctx.date(n.at)}
                  {n.form && <span className="ml-1.5" title={n.form === "hot" ? sb.hot : sb.cold}>{n.form === "hot" ? "🔥" : "🥶"}</span>}
                </span>
                <span className="font-body text-xs text-muted">
                  {format(sb.sessionLine, { n: n.n, w: n.w, l: n.n - n.w })}
                  {n.mama > 0 && ` · ${n.mama} mama`}
                </span>
              </span>
              <span className={cn("font-heading font-bold text-[17px] tabular-nums", tone(n.elo))}>{signed(n.elo)}</span>
            </div>
          ))}
        </BlockCard>
      );

    case "bestPartner": {
      const p = s.bestPartner;
      return (
        <BlockCard size={size} label={title}>
          {head}
          {!p ? (
            <span className="font-body text-[13px] text-muted">{sb.notEnough}</span>
          ) : (
            <>
              <div className="flex">
                <span className="w-10 h-10 rounded-pill bg-amber text-ink border-[3px] border-surface-deep flex items-center justify-center font-display font-extrabold text-sm">{initials(name(ctx.playerId))}</span>
                <span className="w-10 h-10 -ml-3 rounded-pill bg-[#343b3e] border-[3px] border-surface-deep flex items-center justify-center font-display font-extrabold text-sm">{initials(name(p.id))}</span>
              </div>
              <span className="flex flex-col">
                <span className="font-display font-extrabold text-[22px] leading-none uppercase truncate">{name(p.id)}</span>
                <span className="font-body text-xs text-muted">
                  {p.w}–{p.l} · {p.pct}%
                </span>
              </span>
            </>
          )}
        </BlockCard>
      );
    }

    case "partners":
      return (
        <BlockCard size={size} label={title}>
          <span className={kicker}>
            {title} · {format(sb.minGames, { n: s.minPartner })}
          </span>
          {s.partners.length === 0 && <span className="font-body text-[13px] text-muted">{sb.notEnough}</span>}
          {s.partners.slice(0, size === "L" ? 8 : 4).map((r, i) => (
            <div key={r.id} className="grid grid-cols-[80px_1fr_44px] items-center gap-2.5 h-7.5" title={format(sb.together, { w: r.w, l: r.l })}>
              <span className="font-body font-semibold text-sm truncate">{name(r.id)}</span>
              <div className="h-3 rounded-[6px] bg-surface-raised overflow-hidden">
                <div className={cn("h-full rounded-[6px]", r.pct >= 60 || (i === 0 && r.pct >= 50) ? "bg-amber" : "bg-[#6b746f]")} style={{ width: `${r.pct}%` }} />
              </div>
              <span className="text-right font-heading font-bold text-[17px]">{r.pct}%</span>
            </div>
          ))}
        </BlockCard>
      );

    case "h2h": {
      const list = s.rivals.slice(0, size === "S" ? 1 : size === "M" ? 3 : 6);
      return (
        <BlockCard size={size} label={title}>
          {head}
          {list.length === 0 && none}
          {size === "S" && list[0] ? (
            <span className="flex flex-col">
              <span className="font-body text-xs text-muted">{sb.vs}</span>
              <span className="font-display font-extrabold text-[22px] leading-none uppercase truncate">{name(list[0].id)}</span>
              <span className={cn(big, "text-[34px] tabular-nums mt-1", list[0].w >= list[0].l ? "text-gold" : "")}>
                {list[0].w}–{list[0].l}
              </span>
            </span>
          ) : (
            list.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-1.5 border-t border-cream/6 first-of-type:border-0">
                <span className="w-9 h-9 rounded-pill bg-chip flex items-center justify-center font-display font-extrabold text-[13px]">{initials(name(r.id))}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-body font-semibold text-[15px] truncate">
                    {sb.vs} {name(r.id)}
                  </span>
                  <span className="font-body text-xs text-muted">
                    {r.n} {sb.games}
                  </span>
                </span>
                <span className={cn("font-heading font-extrabold text-xl tabular-nums", r.w > r.l ? "text-gold" : r.w < r.l ? "text-red-pale" : "")}>
                  {r.w}–{r.l}
                </span>
              </div>
            ))
          )}
        </BlockCard>
      );
    }

    case "records": {
      const cats = [
        [sb.rec.kruipen, s.records.kruipen],
        [sb.rec.mama, s.records.mama],
        [sb.rec.streak, s.records.streak],
        [sb.rec.games, s.records.games],
      ] as const;
      return (
        <BlockCard size={size} label={title}>
          {head}
          <div className={cn("grid gap-2", size === "L" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2")}>
            {cats.map(([k, rows]) => (
              <div key={k} className="flex flex-col gap-1 px-3 py-2.5 rounded-[12px] bg-surface-raised">
                <span className="font-heading font-semibold text-[11px] tracking-[0.12em] text-muted uppercase">{k}</span>
                {rows.length === 0 && <span className="font-body text-[13px] text-muted">—</span>}
                {rows.slice(0, size === "L" ? 3 : 1).map((x, i) => (
                  <div key={x.id} className="flex items-center gap-2">
                    {size === "L" && <span className={cn("w-4 font-heading font-bold text-sm", i === 0 ? "text-gold" : "text-muted")}>{i + 1}</span>}
                    <span className={cn("flex-1 min-w-0 truncate font-body text-sm", x.id === ctx.playerId && "font-semibold text-gold")}>{name(x.id)}</span>
                    <span className="font-heading font-bold text-[17px]">{x.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </BlockCard>
      );
    }

    case "crewMama":
      return (
        <BlockCard size={size} label={title}>
          <span className={kicker}>
            {title} · {ctx.crewName}
          </span>
          {s.crewMamaBoard.length === 0 && none}
          <Rows rows={s.crewMamaBoard.slice(0, size === "L" ? 8 : 4)} name={name} highlight={ctx.playerId} />
        </BlockCard>
      );

    case "crewRanking":
      return (
        <BlockCard size={size} label={title}>
          {head}
          {s.ranking.slice(0, size === "L" ? 10 : 5).map((r, i) => (
            <div key={r.id} className="grid grid-cols-[22px_minmax(0,1fr)_52px_44px] gap-2 items-center h-8">
              <span className={cn("font-heading font-extrabold text-base", i === 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
              <span className={cn("truncate font-body text-sm", r.id === ctx.playerId ? "font-bold text-gold" : "font-semibold")}>{name(r.id)}</span>
              <span className="text-right font-heading font-extrabold text-lg tabular-nums">{r.elo}</span>
              <span className={cn("text-right font-heading font-bold text-sm tabular-nums", tone(r.change))}>{signed(r.change)}</span>
            </div>
          ))}
        </BlockCard>
      );
  }
}

function EloBlock({ s, ctx, size, title }: Readonly<{ s: StatsScope; ctx: BlockCtx; size: StatsBlock["size"]; title: string }>) {
  const { sb } = ctx;
  const [picked, setPicked] = useState<string | null>(null);
  const pickedGame = picked ? s.games.find((g) => g.id === picked) : undefined;
  const pickedPoint = picked ? s.curve.pts.find((p) => p.g === picked) : undefined;
  return (
    <BlockCard size={size} label={title}>
      <span className={kicker}>{title}</span>
      <div className="flex items-baseline gap-2.5">
        <span className={cn(big, "text-[44px]")}>{s.curve.now}</span>
        {s.curve.pts.length > 0 && (
          <span className={cn("font-heading font-extrabold text-lg", tone(s.curve.change))}>
            {s.curve.change > 0 ? "▲" : s.curve.change < 0 ? "▼" : "•"} {Math.abs(s.curve.change)}
          </span>
        )}
        <span className="font-body text-xs text-muted">{sb.inPeriod}</span>
      </div>
      {s.curve.pts.length < 2 ? (
        <p className="font-body text-[13px] text-muted py-6 text-center">{sb.tooFew}</p>
      ) : (
        <EloChart points={s.curve.pts} start={s.curve.start} picked={picked} onPick={setPicked} label={ctx.date} aria={title} short={size === "M"} />
      )}
      {pickedGame && pickedPoint && (
        <GameDetail
          game={pickedGame}
          playerId={ctx.playerId}
          delta={pickedPoint.d}
          when={ctx.dateTime(pickedGame.playedAt)}
          name={ctx.name}
          labels={{ won: sb.won, lost: sb.lost, with: sb.with, vs: sb.vs, open: sb.openGame, kruip: sb.kruiped }}
        />
      )}
    </BlockCard>
  );
}

/** Single-series Elo line (one point per game, evenly spaced so busy nights
 * don't collapse into one spike). Tap/drag to pick a game. */
function EloChart({
  points,
  start,
  picked,
  onPick,
  label,
  aria,
  short = false,
}: Readonly<{ points: StatsEloPoint[]; start: number; picked: string | null; onPick: (id: string) => void; label: (iso: string) => string; aria: string; short?: boolean }>) {
  const W = 320;
  const H = short ? 110 : 150;
  const L = 34;
  const R = 8;
  const T = 8;
  const B = 22;
  const values = [start, ...points.map((p) => p.r)];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max(8, (hi - lo) * 0.12);
  lo = Math.floor((lo - pad) / 10) * 10;
  hi = Math.ceil((hi + pad) / 10) * 10;
  const n = points.length;
  const x = (i: number) => L + (i / n) * (W - L - R); // index 0 = the rating going in
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const pickedIdx = picked ? points.findIndex((p) => p.g === picked) : -1;

  function pickAt(clientX: number, el: SVGSVGElement) {
    const box = el.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * W;
    const i = Math.round(((sx - L) / (W - L - R)) * n) - 1;
    const p = points[Math.min(n - 1, Math.max(0, i))];
    if (p) onPick(p.g);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={aria}
      className="w-full h-auto touch-pan-y select-none"
      onPointerDown={(e) => pickAt(e.clientX, e.currentTarget)}
      onPointerMove={(e) => e.buttons && pickAt(e.clientX, e.currentTarget)}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-cream/8" strokeWidth={1} />
          <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="fill-muted font-body text-[10px]">
            {v}
          </text>
        </g>
      ))}
      {lo < ELO_BASE && hi > ELO_BASE && (
        <line x1={L} x2={W - R} y1={y(ELO_BASE)} y2={y(ELO_BASE)} stroke="currentColor" className="text-cream/20" strokeDasharray="3 4" strokeWidth={1} />
      )}
      <text x={x(0)} y={H - 6} className="fill-muted font-body text-[10px]">
        {label(points[0].t)}
      </text>
      <text x={W - R} y={H - 6} textAnchor="end" className="fill-muted font-body text-[10px]">
        {label(points[n - 1].t)}
      </text>
      <path d={path} fill="none" stroke="currentColor" className="text-amber" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pickedIdx >= 0 && (
        <>
          <line x1={x(pickedIdx + 1)} x2={x(pickedIdx + 1)} y1={T} y2={H - B} stroke="currentColor" className="text-cream/30" strokeWidth={1} />
          <circle cx={x(pickedIdx + 1)} cy={y(points[pickedIdx].r)} r={5} className="fill-amber stroke-surface-deep" strokeWidth={2} />
        </>
      )}
      <circle cx={x(n)} cy={y(points[n - 1].r)} r={4} className="fill-amber stroke-surface-deep" strokeWidth={2} />
    </svg>
  );
}

function GameDetail({
  game,
  playerId,
  delta,
  when,
  name,
  labels,
}: Readonly<{
  game: StatsGame;
  playerId: string;
  delta: number;
  when: string;
  name: (id: string) => string;
  labels: { won: string; lost: string; with: string; vs: string; open: string; kruip: string };
}>) {
  const mine = game.teams.find((x) => x.userIds.includes(playerId))!;
  const partners = mine.userIds.filter((u) => u !== playerId).map(name);
  const opponents = game.teams.filter((x) => x !== mine).map((x) => x.userIds.map(name).join(" & "));
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] bg-surface-raised border border-line">
      <span className={cn("font-heading font-extrabold text-[13px] tracking-[0.1em] px-2 py-1 rounded-sm", mine.won ? "bg-amber text-ink" : "bg-chip text-soft")}>
        {mine.won ? labels.won : labels.lost}
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-body font-semibold text-sm truncate">
          {partners.length > 0 && `${labels.with} ${partners.join(" & ")} · `}
          {labels.vs} {opponents.join(", ")}
        </span>
        <span className="font-body text-xs text-muted">
          {when}
          {mine.kruip && ` · ${labels.kruip}`}
        </span>
      </span>
      <span className={cn("font-heading font-bold text-[17px]", delta > 0 ? "text-mint" : delta < 0 ? "text-red-pale" : "text-muted")}>
        {delta > 0 ? "+" : ""}
        {delta}
      </span>
      <Link href={`/game/${game.id}`} aria-label={labels.open} className="w-9 h-9 rounded-pill bg-surface-panel border border-line text-cream flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}
