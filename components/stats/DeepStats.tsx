"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StatsExplorerData, StatsGame } from "@/lib/db/stats";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";

type Who = "me" | "duo" | "crew";
type MatF = "all" | "4" | "8" | "2";
type Period = "30d" | "season" | "ever";
const DAY = 24 * 3600 * 1000;

/** v2 deep stats: three chip rows (who / mat / period), totals, a shots panel
 * (mama rate or the full zone split) and win % by partner (or by player for
 * the whole crew). Everything is sliced client-side from one payload. */
export function DeepStats({ data, currentUserId, backHref }: Readonly<{ data: StatsExplorerData; currentUserId: string; backHref: string }>) {
  const [who, setWho] = useState<Who>("me");
  const [mat, setMat] = useState<MatF>("all");
  const [period, setPeriod] = useState<Period>("season");
  const [shot, setShot] = useState<"mama" | "zones">("mama");
  const [now] = useState(() => Date.now());

  // The crew this page is about: where the viewer played the most.
  const crew = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of data.games) if (g.crewId && g.teams.some((t) => t.userIds.includes(currentUserId))) count.set(g.crewId, (count.get(g.crewId) ?? 0) + 1);
    return [...data.crews].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0];
  }, [data, currentUserId]);

  const nameOf = useMemo(() => new Map(data.people.map((p) => [p.id, firstName(p.name)])), [data.people]);

  const s = useMemo(() => {
    const year = new Date(now).getFullYear();
    const inScope = (g: StatsGame) =>
      g.crewId === crew?.id &&
      (mat === "all" || g.matType === mat) &&
      (period === "ever" || (period === "30d" ? now - new Date(g.playedAt).getTime() <= 30 * DAY : new Date(g.playedAt).getFullYear() === year));
    const games = data.games.filter(inScope);

    // Crew-wide mama rate per player-game (the "crew avg" reference).
    let crewMama = 0;
    let crewSlots = 0;
    for (const g of games) for (const t of g.teams) for (const u of t.userIds) {
      crewSlots++;
      crewMama += t.shots[u]?.risk ?? 0;
    }

    const mine = games
      .map((g) => ({ g, team: g.teams.find((t) => t.userIds.includes(currentUserId)) }))
      .filter((x): x is { g: StatsGame; team: StatsGame["teams"][number] } => !!x.team)
      .filter((x) => who !== "duo" || x.team.userIds.length === 2);

    const zones = { near: 0, mid: 0, far: 0, risk: 0, miss: 0 };
    let tracked = 0;
    const addZones = (c: { near: number; mid: number; far: number; risk: number; miss: number }) => {
      const any = c.near + c.mid + c.far + c.miss;
      if (!any) return;
      tracked++;
      zones.near += c.near;
      zones.mid += c.mid;
      zones.far += c.far;
      zones.risk += c.risk;
      zones.miss += c.miss;
    };

    if (who === "crew") {
      const per = new Map<string, { w: number; n: number }>();
      for (const g of games) for (const t of g.teams) for (const u of t.userIds) {
        const e = per.get(u) ?? { w: 0, n: 0 };
        e.n++;
        if (t.won) e.w++;
        per.set(u, e);
        if (t.shots[u]) addZones(t.shots[u]);
      }
      const mamaGames = games.filter((g) => g.teams.some((t) => t.userIds.some((u) => (t.shots[u]?.risk ?? 0) > 0))).length;
      const best = Math.max(0, ...games.flatMap((g) => g.teams.flatMap((t) => t.userIds.map((u) => t.shots[u]?.risk ?? 0))));
      return {
        totals: [
          { k: "GAMES", v: String(games.length) },
          { k: "PLAYERS", v: String(per.size) },
          { k: "MAMA / GAME", v: crewSlots ? (crewMama / games.length).toFixed(2) : "—" },
        ],
        mamaPct: games.length ? Math.round((mamaGames / games.length) * 100) : 0,
        mamaLine: `of games have a mama (${mamaGames} of ${games.length})`,
        you: crewSlots ? `${(crewMama / crewSlots).toFixed(2)} / player` : "—",
        avg: "",
        best,
        rows: rank(per),
        rowLabel: "WIN % BY PLAYER",
        zones,
        tracked,
      };
    }

    let wins = 0;
    let myMama = 0;
    let mamaGames = 0;
    let best = 0;
    const per = new Map<string, { w: number; n: number }>();
    for (const { team } of mine) {
      if (team.won) wins++;
      const m = team.shots[currentUserId]?.risk ?? 0;
      myMama += m;
      if (m > 0) mamaGames++;
      best = Math.max(best, m);
      if (team.shots[currentUserId]) addZones(team.shots[currentUserId]);
      for (const u of team.userIds) {
        if (u === currentUserId) continue;
        const e = per.get(u) ?? { w: 0, n: 0 };
        e.n++;
        if (team.won) e.w++;
        per.set(u, e);
      }
    }
    const n = mine.length;
    return {
      totals: [
        { k: "GAMES", v: String(n) },
        { k: "WIN %", v: n ? `${Math.round((wins / n) * 100)}%` : "—" },
        { k: "MAMA / GAME", v: n ? (myMama / n).toFixed(2) : "—" },
      ],
      mamaPct: n ? Math.round((mamaGames / n) * 100) : 0,
      mamaLine: `of your games have a mama (${mamaGames} of ${n})`,
      you: n ? `You ${(myMama / n).toFixed(2)} / game` : "—",
      avg: crewSlots && crew ? `${crew.name} avg ${(crewMama / crewSlots).toFixed(2)}` : "",
      best,
      rows: rank(per),
      rowLabel: "WIN % BY PARTNER",
      zones,
      tracked,
    };

    function rank(map: Map<string, { w: number; n: number }>) {
      const all = [...map.entries()];
      const min = all.some(([, e]) => e.n >= 10) ? 10 : 3;
      return {
        min,
        list: all
          .filter(([, e]) => e.n >= min)
          .map(([id, e]) => ({ id, pct: Math.round((e.w / e.n) * 100) }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 8),
      };
    }
  }, [data.games, crew, mat, period, who, currentUserId, now]);

  const zoneTotal = s.zones.near + s.zones.mid + s.zones.far + s.zones.risk + s.zones.miss;
  const zp = (n: number) => (zoneTotal ? Math.round((n / zoneTotal) * 100) : 0);

  return (
    <div className="min-h-screen bg-surface flex flex-col gap-3 px-5 pt-4.5 pb-6 w-full max-w-xl mx-auto">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={backHref}
          aria-label="Back"
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display font-extrabold text-[26px] tracking-[0.04em]">DEEP STATS</h1>
        {crew && <span className="font-body font-semibold text-[13px] text-muted truncate max-w-28">{crew.name}</span>}
      </header>

      <div className="flex flex-col gap-2">
        <Chips label="Who" value={who} onChange={setWho} options={[["me", "ME"], ["duo", "DUO"], ["crew", "CREW"]]} />
        <Chips label="Mat" value={mat} onChange={setMat} options={[["all", "ALL"], ["4", "4-MAT"], ["8", "8-MAT"], ["2", "1V1"]]} />
        <Chips label="Period" value={period} onChange={setPeriod} options={[["30d", "30 DAYS"], ["season", "SEASON"], ["ever", "ALL TIME"]]} />
      </div>

      <section aria-label="Totals" className="grid grid-cols-3 gap-px rounded-[14px] overflow-hidden bg-line">
        {s.totals.map((x) => (
          <div key={x.k} className="bg-surface-deep p-3 flex flex-col gap-0.5">
            <span className="font-body font-semibold text-[10px] tracking-[0.08em] text-muted">{x.k}</span>
            <span className="font-display font-bold text-[28px] leading-none">{x.v}</span>
          </div>
        ))}
      </section>

      <section aria-label="Shots" className="flex flex-col gap-2 p-3.5 rounded-[16px] bg-surface-deep border border-line">
        <div className="flex justify-between items-center">
          <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">SHOTS</span>
          <div role="tablist" aria-label="Shot view" className="flex gap-1">
            {(
              [
                ["mama", "MAMA"],
                ["zones", "ALL ZONES"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={shot === id}
                onClick={() => setShot(id)}
                className={cn(
                  "h-8 px-2.5 rounded-sm font-heading font-bold text-[13px] tracking-[0.06em]",
                  shot === id ? "bg-amber text-ink" : "bg-surface-raised text-muted border border-line",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shot === "mama" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-extrabold text-[34px] leading-none text-red">{s.mamaPct}%</span>
              <span className="font-body text-[13px] text-soft">{s.mamaLine}</span>
            </div>
            <div className="h-2.5 rounded-[5px] overflow-hidden bg-chip">
              <div className="h-full bg-red" style={{ width: `${s.mamaPct}%` }} />
            </div>
            <div className="flex justify-between font-body font-semibold text-xs text-soft">
              <span>{s.you}</span>
              {s.avg && <span className="text-muted">{s.avg}</span>}
              <span>Best: {s.best} in a game</span>
            </div>
          </div>
        ) : s.tracked === 0 ? (
          <p className="font-body text-[13px] text-muted">No shot tracking in this slice yet — switch on “Track every shot” when you log a game.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex h-7 rounded-sm overflow-hidden gap-0.5">
              <div className="bg-soft" style={{ width: `${zp(s.zones.near)}%` }} />
              <div className="bg-[#8e9690]" style={{ width: `${zp(s.zones.mid)}%` }} />
              <div className="bg-[#5b6460]" style={{ width: `${zp(s.zones.far)}%` }} />
              <div className="bg-red" style={{ width: `${zp(s.zones.risk)}%` }} />
              <div className="bg-chip" style={{ width: `${zp(s.zones.miss)}%` }} />
            </div>
            <div className="flex justify-between font-body font-semibold text-xs text-soft">
              <span>1 · {zp(s.zones.near)}%</span>
              <span>2 · {zp(s.zones.mid)}%</span>
              <span>3 · {zp(s.zones.far)}%</span>
              <span className="text-red-pale">MAMA · {zp(s.zones.risk)}%</span>
              <span className="text-muted">MISS · {zp(s.zones.miss)}%</span>
            </div>
            <span className="font-body text-xs text-muted">From {s.tracked} games logged with shot tracking on.</span>
          </div>
        )}
      </section>

      <section aria-label={s.rowLabel} className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-[12px] tracking-[0.14em] text-muted">
          {s.rowLabel} · {s.rows.min}+ GAMES
        </span>
        {s.rows.list.length === 0 && <p className="font-body text-[13px] text-muted">Not enough games in this slice yet.</p>}
        {s.rows.list.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[80px_1fr_44px] items-center gap-2.5 h-7.5">
            <span className="font-body font-semibold text-sm truncate">{nameOf.get(r.id) ?? "Player"}</span>
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

function Chips<T extends string>({
  label,
  value,
  onChange,
  options,
}: Readonly<{ label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 h-9 rounded-[10px] font-heading font-bold text-sm tracking-[0.06em]",
            value === id ? "bg-amber text-ink" : "bg-surface-deep text-muted border border-line",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
