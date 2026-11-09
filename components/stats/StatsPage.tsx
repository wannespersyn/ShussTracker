/**
 * StatsPage
 *
 * Stats v3: one crew, one player, one period. Elo curve over time (tap a point
 * for that game), totals incl. mama's and kruipen, form per session, crew
 * records and win % by partner.
 *
 * Data: one StatsExplorerData payload from the stats page, sliced in memory.
 * Notes: all copy comes from the active dictionary (t.stats3).
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StatsExplorerData, StatsGame, StatsEloPoint } from "@/lib/db/stats";
import { ELO_BASE } from "@/lib/elo";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

type Period = "session" | "7d" | "30d" | "season" | "ever" | "custom";
const DAY = 24 * 3600 * 1000;
/** Games further apart than this belong to different sessions (nights). */
const SESSION_GAP = 3 * 3600 * 1000;
/** A session is "on fire"/"ice cold" when its win % is this many points off the all-time win %. */
const FORM_SWING = 15;

type Mine = { g: StatsGame; team: StatsGame["teams"][number] };

/** Splits games (any order) into sessions: runs with < 3h between games, newest first. */
function sessionsOf(games: StatsGame[]): StatsGame[][] {
  const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const out: StatsGame[][] = [];
  for (const g of sorted) {
    const cur = out[out.length - 1];
    if (cur && new Date(g.playedAt).getTime() - new Date(cur[cur.length - 1].playedAt).getTime() < SESSION_GAP) cur.push(g);
    else out.push([g]);
  }
  return out.reverse();
}

/** Longest run of wins in these games, oldest first. */
function longestStreak(m: Mine[]): number {
  let best = 0;
  let run = 0;
  for (const x of [...m].sort((a, b) => a.g.playedAt.localeCompare(b.g.playedAt))) {
    run = x.team.won ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

const dayInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function StatsPage({ data, currentUserId, backHref }: Readonly<{ data: StatsExplorerData; currentUserId: string; backHref: string }>) {
  const { t, locale } = useT();
  const d = t.stats3;
  const [now] = useState(() => Date.now());

  // Default crew: where the viewer played the most.
  const defaultCrew = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of data.games) if (g.crewId && g.teams.some((x) => x.userIds.includes(currentUserId))) count.set(g.crewId, (count.get(g.crewId) ?? 0) + 1);
    return [...data.crews].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0]?.id ?? "";
  }, [data, currentUserId]);

  const [crewId, setCrewId] = useState(defaultCrew);
  const [playerId, setPlayerId] = useState(currentUserId);
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => dayInput(now - 30 * DAY));
  const [to, setTo] = useState(() => dayInput(now));
  const [picked, setPicked] = useState<string | null>(null);

  const nameOf = useMemo(() => new Map(data.people.map((p) => [p.id, firstName(p.name)])), [data.people]);
  const name = (id: string) => nameOf.get(id) ?? t.more.player;
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
  const dateTimeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [locale]);

  const crewGames = useMemo(() => data.games.filter((g) => g.crewId === crewId), [data.games, crewId]);
  const crewPeople = useMemo(() => {
    const ids = new Set(crewGames.flatMap((g) => g.teams.flatMap((x) => x.userIds)));
    return [...ids].sort((a, b) => name(a).localeCompare(name(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewGames, nameOf]);

  /** [start, end) of the selected period in ms. */
  const range = useMemo((): [number, number] => {
    if (period === "ever") return [0, Infinity];
    if (period === "7d") return [now - 7 * DAY, Infinity];
    if (period === "30d") return [now - 30 * DAY, Infinity];
    if (period === "season") return [new Date(new Date(now).getFullYear(), 0, 1).getTime(), Infinity];
    if (period === "session") {
      const last = sessionsOf(crewGames.filter((g) => g.teams.some((x) => x.userIds.includes(playerId))))[0];
      return last ? [new Date(last[0].playedAt).getTime(), Infinity] : [now, Infinity];
    }
    const a = new Date(`${from}T00:00`).getTime();
    const b = new Date(`${to}T00:00`).getTime() + DAY;
    return [Number.isNaN(a) ? 0 : a, Number.isNaN(b) ? Infinity : b];
  }, [period, now, crewGames, playerId, from, to]);

  const inRange = (iso: string) => {
    const ms = new Date(iso).getTime();
    return ms >= range[0] && ms < range[1];
  };

  const games = useMemo(() => crewGames.filter((g) => inRange(g.playedAt)), [crewGames, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const mineOf = (list: StatsGame[], id: string): Mine[] =>
    list
      .map((g) => ({ g, team: g.teams.find((x) => x.userIds.includes(id)) }))
      .filter((x): x is Mine => !!x.team);

  // ---- Elo curve -------------------------------------------------------
  const curve = useMemo(() => {
    const all: StatsEloPoint[] = data.elo[crewId]?.[playerId] ?? [];
    const pts = all.filter((p) => inRange(p.t));
    const before = all.filter((p) => new Date(p.t).getTime() < range[0]).at(-1);
    const start = before?.r ?? (pts[0] ? pts[0].r - pts[0].d : ELO_BASE);
    return { pts, start, now: pts.at(-1)?.r ?? start, change: (pts.at(-1)?.r ?? start) - start };
  }, [data.elo, crewId, playerId, range]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Totals -----------------------------------------------------------
  const mine = useMemo(() => mineOf(games, playerId), [games, playerId]);  
  const allMine = useMemo(() => mineOf(crewGames, playerId), [crewGames, playerId]);  
  const wins = mine.filter((x) => x.team.won).length;
  const mamas = mine.reduce((n, x) => n + (x.team.shots[playerId]?.risk ?? 0), 0);
  const kruipen = mine.filter((x) => x.team.kruip).length;
  const allTimePct = allMine.length ? (allMine.filter((x) => x.team.won).length / allMine.length) * 100 : 0;

  // ---- Sessions ---------------------------------------------------------
  const eloByGame = useMemo(() => new Map((data.elo[crewId]?.[playerId] ?? []).map((p) => [p.g, p.d])), [data.elo, crewId, playerId]);
  const sessions = useMemo(
    () =>
      sessionsOf(mine.map((x) => x.g)).map((list) => {
        const m = mineOf(list, playerId);
        const w = m.filter((x) => x.team.won).length;
        const pct = (w / m.length) * 100;
        return {
          key: list[0].id,
          at: list[0].playedAt,
          n: m.length,
          w,
          elo: m.reduce((s, x) => s + (eloByGame.get(x.g.id) ?? 0), 0),
          mama: m.reduce((s, x) => s + (x.team.shots[playerId]?.risk ?? 0), 0),
          form: m.length >= 3 && allMine.length >= 10 ? (pct - allTimePct >= FORM_SWING ? "hot" : allTimePct - pct >= FORM_SWING ? "cold" : null) : null,
        };
      }),
    [mine, playerId, eloByGame, allMine.length, allTimePct],  
  );

  // ---- Crew records (in period) -----------------------------------------
  const records = useMemo(() => {
    const tally = (score: (m: Mine[], id: string) => number) =>
      crewPeople
        .map((id) => ({ id, v: score(mineOf(games, id), id) }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 3);
    return [
      { k: d.recKruip, rows: tally((m) => m.filter((x) => x.team.kruip).length) },
      { k: d.recMama, rows: tally((m, id) => m.reduce((n, x) => n + (x.team.shots[id]?.risk ?? 0), 0)) },
      { k: d.recStreak, rows: tally(longestStreak) },
      { k: d.recGames, rows: tally((m) => m.length) },
    ];
  }, [games, crewPeople, d]);  

  // ---- Win % by partner -------------------------------------------------
  const partners = useMemo(() => {
    const per = new Map<string, { w: number; n: number }>();
    for (const { team } of mine)
      for (const u of team.userIds) {
        if (u === playerId) continue;
        const e = per.get(u) ?? { w: 0, n: 0 };
        e.n++;
        if (team.won) e.w++;
        per.set(u, e);
      }
    const min = [...per.values()].some((e) => e.n >= 10) ? 10 : 3;
    return {
      min,
      list: [...per]
        .filter(([, e]) => e.n >= min)
        .map(([id, e]) => ({ id, pct: Math.round((e.w / e.n) * 100), n: e.n }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8),
    };
  }, [mine, playerId]);

  const pickedGame = picked ? games.find((g) => g.id === picked) : undefined;
  const pickedPoint = picked ? curve.pts.find((p) => p.g === picked) : undefined;

  const crew = data.crews.find((c) => c.id === crewId);
  const isMe = playerId === currentUserId;

  return (
    <div className="min-h-screen bg-surface flex flex-col gap-3 px-5 pt-4.5 pb-6 w-full max-w-xl mx-auto">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={backHref}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display font-extrabold text-[26px] tracking-[0.04em] uppercase">{d.title}</h1>
      </header>

      {/* Filters: crew + player, then period */}
      <div className="flex gap-2">
        {data.crews.length > 1 && (
          <Select label={d.crew} value={crewId} onChange={(v) => { setCrewId(v); setPicked(null); }} options={data.crews.map((c) => [c.id, c.name])} />
        )}
        <Select
          label={d.player}
          value={playerId}
          onChange={(v) => { setPlayerId(v); setPicked(null); }}
          options={(crewPeople.includes(currentUserId) ? crewPeople : [currentUserId, ...crewPeople]).map((id) => [id, id === currentUserId ? d.me : name(id)])}
        />
      </div>
      <div role="group" aria-label={d.period} className="flex gap-1.5 overflow-x-auto -mx-5 px-5">
        {(
          [
            ["session", d.pSession],
            ["7d", d.p7],
            ["30d", d.p30],
            ["season", d.pSeason],
            ["ever", d.pEver],
            ["custom", d.pCustom],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={period === id}
            onClick={() => { setPeriod(id); setPicked(null); }}
            className={cn(
              "shrink-0 h-9 px-3 rounded-[10px] font-heading font-bold text-sm tracking-[0.06em]",
              period === id ? "bg-amber text-ink" : "bg-surface-deep text-muted border border-line",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-2 font-body text-sm text-muted">
          <input type="date" aria-label={d.from} value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="flex-1 h-10 px-3 rounded-[10px] bg-surface-deep border border-line text-cream" />
          <span>→</span>
          <input type="date" aria-label={d.to} value={to} min={from} onChange={(e) => setTo(e.target.value)} className="flex-1 h-10 px-3 rounded-[10px] bg-surface-deep border border-line text-cream" />
        </div>
      )}

      {/* Elo curve */}
      <section aria-label={d.elo} className="flex flex-col gap-2 p-3.5 rounded-[16px] bg-surface-deep border border-line">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">{d.elo}</span>
          <span className="font-body text-xs text-muted truncate">{crew?.name}</span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display font-extrabold text-[40px] leading-none">{curve.now}</span>
          {curve.pts.length > 0 && (
            <span className={cn("font-heading font-bold text-lg", curve.change > 0 ? "text-mint" : curve.change < 0 ? "text-red-pale" : "text-muted")}>
              {curve.change > 0 ? "▲" : curve.change < 0 ? "▼" : "•"} {Math.abs(curve.change)}
            </span>
          )}
          <span className="font-body text-xs text-muted">{d.inPeriod}</span>
        </div>
        {curve.pts.length < 2 ? (
          <p className="font-body text-[13px] text-muted py-6 text-center">{d.tooFew}</p>
        ) : (
          <EloChart points={curve.pts} start={curve.start} picked={picked} onPick={setPicked} label={(iso) => dateFmt.format(new Date(iso))} aria={d.elo} />
        )}
        {pickedGame && pickedPoint && (
          <GameDetail
            game={pickedGame}
            playerId={playerId}
            delta={pickedPoint.d}
            when={dateTimeFmt.format(new Date(pickedGame.playedAt))}
            name={name}
            labels={{ won: d.won, lost: d.lost, with: d.with, vs: d.vs, open: d.openGame, kruip: d.kruiped }}
          />
        )}
      </section>

      {/* Totals */}
      <section aria-label={d.totals} className="grid grid-cols-3 gap-px rounded-[14px] overflow-hidden bg-line">
        {[
          { k: d.games, v: String(mine.length) },
          { k: d.winPct, v: mine.length ? `${Math.round((wins / mine.length) * 100)}%` : "—" },
          { k: d.mamaGame, v: mine.length ? (mamas / mine.length).toFixed(2) : "—" },
          { k: d.mamas, v: String(mamas) },
          { k: d.streak, v: String(longestStreak(mine)) },
          { k: d.kruipen, v: String(kruipen) },
        ].map((x) => (
          <div key={x.k} className="bg-surface-deep p-3 flex flex-col gap-0.5">
            <span className="font-body font-semibold text-[10px] tracking-[0.08em] text-muted uppercase">{x.k}</span>
            <span className="font-display font-bold text-[28px] leading-none">{x.v}</span>
          </div>
        ))}
      </section>

      {/* Sessions */}
      <section aria-label={d.sessions} className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">{isMe ? d.sessions : format(d.sessionsOf, { name: name(playerId) })}</span>
        {sessions.length === 0 && <p className="font-body text-[13px] text-muted">{d.noGames}</p>}
        {sessions.slice(0, 12).map((s) => (
          <div key={s.key} className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line">
            <span className="flex-1 flex flex-col">
              <span className="font-body font-semibold text-sm">
                {dateFmt.format(new Date(s.at))}
                {s.form && <span className="ml-1.5" title={s.form === "hot" ? d.hot : d.cold}>{s.form === "hot" ? "🔥" : "🥶"}</span>}
              </span>
              <span className="font-body text-xs text-muted">
                {format(d.sessionLine, { n: s.n, w: s.w, l: s.n - s.w })}
                {s.mama > 0 && ` · ${s.mama} ${d.mamaShort}`}
              </span>
            </span>
            <span className={cn("font-heading font-bold text-[17px]", s.elo > 0 ? "text-mint" : s.elo < 0 ? "text-red-pale" : "text-muted")}>
              {s.elo > 0 ? "+" : ""}
              {s.elo}
            </span>
          </div>
        ))}
      </section>

      {/* Crew records */}
      <section aria-label={d.records} className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">{d.records}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {records.map((r) => (
            <div key={r.k} className="flex flex-col gap-1 px-3.5 py-2.5 rounded-[14px] bg-surface-deep border border-line">
              <span className="font-heading font-semibold text-[11px] tracking-[0.14em] text-muted uppercase">{r.k}</span>
              {r.rows.length === 0 && <span className="font-body text-[13px] text-muted">—</span>}
              {r.rows.map((x, i) => (
                <div key={x.id} className="flex items-center gap-2">
                  <span className={cn("w-5 font-heading font-bold text-sm", i === 0 ? "text-gold" : "text-muted")}>{i + 1}</span>
                  <span className={cn("flex-1 font-body text-sm truncate", x.id === playerId && "font-semibold")}>{name(x.id)}</span>
                  <span className="font-heading font-bold text-[17px]">{x.v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Win % by partner */}
      <section aria-label={d.byPartner} className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">
          {d.byPartner} · {format(d.minGames, { n: partners.min })}
        </span>
        {partners.list.length === 0 && <p className="font-body text-[13px] text-muted">{d.notEnough}</p>}
        {partners.list.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[80px_1fr_44px] items-center gap-2.5 h-7.5" title={format(d.ofGames, { n: r.n })}>
            <span className="font-body font-semibold text-sm truncate">{name(r.id)}</span>
            <div className="h-3 rounded-[6px] bg-surface-raised overflow-hidden">
              <div className={cn("h-full rounded-[6px]", r.pct >= 60 || (i === 0 && r.pct >= 50) ? "bg-amber" : "bg-[#6b746f]")} style={{ width: `${r.pct}%` }} />
            </div>
            <span className="text-right font-heading font-bold text-[17px]">{r.pct}%</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options }: Readonly<{ label: string; value: string; onChange: (v: string) => void; options: [string, string][] }>) {
  return (
    <label className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="font-heading font-semibold text-[11px] tracking-[0.14em] text-muted uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-[10px] bg-surface-deep border border-line text-cream font-body font-semibold text-sm"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
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
}: Readonly<{ points: StatsEloPoint[]; start: number; picked: string | null; onPick: (id: string) => void; label: (iso: string) => string; aria: string }>) {
  const W = 320;
  const H = 150;
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
