/**
 * CameraLog
 *
 * Beta: the panel next to the camera's throws that shows what the code sees
 * and decides. Two tabs:
 *  - Log: one feed, newest first, of the camera's own events (watching,
 *    paused, new round, mat being cleared, light changed, throw judged) and
 *    of the linked mat logger's game (round start, every throw with where it
 *    counts, own-zone throws, caps shot away, mama shot out, skipped turns,
 *    the drinking per round). Game lines carry the time the camera first saw
 *    them (`seenAt`, kept by the camera), so both kinds mix in order.
 *  - Stats: per player and per team, from the logger's game.
 * Without a linked logger only the camera's events are there.
 */
"use client";

import { useMemo, useState } from "react";
import { gameEvents, gameStats, type CameraGame, type GameEvent } from "@/lib/camera-log";
import { ZONES, teamOfSlot, type Slot } from "@/lib/mat";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

/** A camera event: `tone` colours the line. */
export type CamEvent = { key: string; t: number; text: string; tone?: "warn" | "good" | "muted" };

const MAX_LINES = 200;
/** Same team colours as the mat logger. */
const TEAM_DOT = ["bg-[#EFE7D3]", "bg-[#5FB7FF]"];

/** Names and spot texts for a shared game (also used for the camera's throw list). */
export function useGameText(game: CameraGame | null) {
  const { t } = useT();
  const M = t.mat;
  const name = (s: Slot) => game?.names[s] ?? s.toUpperCase();
  const teamName = (ti: number) =>
    (game?.st.order ?? [])
      .filter((s) => teamOfSlot(s) === ti)
      .map(name)
      .join(" & ") || (ti === 0 ? "A" : "B");
  const sips = (n: number) => (n === 1 ? M.sipsOne : format(M.sipsN, { n }));
  const spot = (code: string, countsFor: number | null = null) => {
    const forTeam = countsFor !== null ? " " + format(M.forTeam, { team: teamName(countsFor) }) : "";
    const z = ZONES.find((x) => x.id === code);
    if (z) return format(M.spotZone, { v: z.v }) + forTeam;
    if (code === "ML" || code === "MR") return M.spotMama + forTeam;
    if (code === "miss") return M.miss.toLowerCase();
    if (code.startsWith("box:")) return format(M.spotBox, { name: name(code.slice(4) as Slot) });
    return code === "off" ? M.spotOff : code === "none" ? M.spotNone : M.spotWaiting;
  };
  return { name, teamName, sips, spot };
}

export function CameraLog({ game, seenAt, events }: Readonly<{ game: CameraGame | null; seenAt: Record<string, number>; events: CamEvent[] }>) {
  const { t } = useT();
  const M = t.mat;
  const L = t.camLive;
  const [tab, setTab] = useState<"log" | "stats">("log");
  const { name, teamName, sips, spot } = useGameText(game);

  function line(e: GameEvent): { text: string; tone?: CamEvent["tone"]; sub?: string } {
    switch (e.kind) {
      case "round":
        return { text: format(L.gRound, { n: e.round }), tone: "good" };
      case "throw": {
        const tags = [e.bonus && L.gBonus, e.own && L.gOwn, e.mamaOut && L.gMamaOut].filter(Boolean).join(" · ");
        return {
          text: format(L.gThrow, { name: name(e.slot), spot: spot(e.spot, e.countsFor) }),
          tone: e.own ? "warn" : undefined,
          sub: [tags, e.cam !== null ? format(L.gCam, { n: e.cam }) : ""].filter(Boolean).join(" · ") || undefined,
        };
      }
      case "knock":
        return { text: format(L.gKnock, { name: name(e.slot), owner: name(e.owner), from: spot(e.from), to: spot(e.to, e.countsFor) }) };
      case "skip":
        return { text: `${name(e.slot)}: ${e.reason === "cap_knocked" ? M.skipKnocked : M.skipBox}`, tone: "muted" };
      case "settle": {
        const parts = e.mamaTeams.length
          ? e.mamaTeams.map((ti) => format(M.mamaLine, { team: teamName(ti) }))
          : e.allDrink
            ? [format(M.allDrink, { n: e.emptyStreak })]
            : [0, 1].map((ti) => `${teamName(ti)}: ${sips(e.sips[ti])}`);
        return {
          text: `${format(M.drinkTitle, { n: e.round })} · ${parts.join(" · ")}`,
          tone: e.mamaTeams.length || e.allDrink ? "warn" : "good",
          sub: e.jokerTeam !== null ? format(M.jokerUsed, { team: teamName(e.jokerTeam) }) : undefined,
        };
      }
      case "clear":
        return { text: format(L.gClear, { n: e.round + 1 }), tone: "muted" };
    }
  }

  const feed = useMemo(() => {
    const fromGame = game ? gameEvents(game).map((e) => ({ key: "g:" + e.key, t: seenAt[e.key] ?? 0, ...line(e) })) : [];
    return [...events.map((e) => ({ ...e, sub: undefined as string | undefined })), ...fromGame].sort((a, b) => b.t - a.t).slice(0, MAX_LINES);
    // line() only reads the game and the dictionaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, seenAt, events, t]);

  const stats = useMemo(() => (game ? gameStats(game) : null), [game]);
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tabBtn = (id: "log" | "stats", label: string) => (
    <button
      type="button"
      aria-pressed={tab === id}
      onClick={() => setTab(id)}
      className={cn("h-9 px-4 rounded-pill font-heading font-bold text-[13px] tracking-[0.08em]", tab === id ? "bg-amber text-ink" : "bg-surface-deep border border-line text-soft")}
    >
      {label}
    </button>
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-heading font-bold text-[12px] tracking-[0.14em] text-gold">{L.logTitle}</span>
        {tabBtn("log", L.tabLog)}
        {tabBtn("stats", L.tabStats)}
      </div>

      {tab === "log" && (
        <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto rounded-[14px] bg-surface-deep border border-line p-2" aria-live="polite">
          {feed.length === 0 && <p className="font-body text-sm text-muted p-2">{L.logEmpty}</p>}
          {feed.map((e) => (
            <div key={e.key} className="flex items-baseline gap-2.5 px-2 py-1.5 rounded-[10px] font-body text-[13px]">
              <span className="shrink-0 w-[58px] font-heading font-bold text-[11px] text-muted tabular-nums">{time(e.t)}</span>
              <span className="flex-1 min-w-0">
                <span className={cn(e.tone === "warn" ? "text-red-pale font-semibold" : e.tone === "good" ? "text-gold font-semibold" : e.tone === "muted" ? "text-muted" : "text-cream")}>
                  {e.text}
                </span>
                {e.sub && <small className="block text-xs text-muted">{e.sub}</small>}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "stats" &&
        (!stats ? (
          <p className="font-body text-sm text-muted p-3 rounded-[14px] bg-surface-deep border border-line">{L.stNoGame}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="font-body text-xs text-muted">{format(L.stOverview, { r: stats.rounds, t: stats.throws })}</span>
            <div className="grid grid-cols-2 gap-2">
              {stats.teams.map((tm) => (
                <div key={tm.team} className="flex flex-col gap-1 p-3 rounded-[14px] bg-surface-deep border border-line">
                  <span className="flex items-center gap-2 font-heading font-bold text-sm min-w-0">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", TEAM_DOT[tm.team])} />
                    <span className="truncate">{teamName(tm.team)}</span>
                  </span>
                  <Row label={L.stSips} value={tm.sips} />
                  <Row label={L.stAf} value={tm.adFundum} />
                  <Row label={L.stJoker} value={tm.jokers ? "✓" : "—"} />
                </div>
              ))}
            </div>
            {stats.players.map((p) => (
              <div key={p.slot} className="flex flex-col gap-1 p-3 rounded-[14px] bg-surface-deep border border-line">
                <span className="flex items-center gap-2 font-heading font-bold text-sm min-w-0">
                  <span className={cn("font-display font-extrabold text-[11px] px-1.5 py-0.5 rounded-[6px] text-ink shrink-0", TEAM_DOT[p.team])}>{p.slot.toUpperCase()}</span>
                  <span className="truncate">{p.name}</span>
                </span>
                <div className="grid grid-cols-2 gap-x-4">
                  <Row label={L.stThrows} value={p.throws} />
                  <Row label={L.stMiss} value={p.misses} />
                  <Row label={L.stHits} value={p.hits.join(" / ")} />
                  <Row label={L.stMama} value={p.mamasOut ? `${p.mamas} (+${p.mamasOut} ${L.stMamaOut})` : p.mamas} />
                  <Row label={L.stOpp} value={p.scored} />
                  <Row label={L.stOwn} value={p.ownThrows ? `${p.ownThrows}× (${p.ownPoints})` : 0} warn={p.ownThrows > 0} />
                  <Row label={L.stKnocks} value={p.knocks} />
                  <Row label={L.stKnockedBy} value={p.knockedBy} />
                  <Row label={L.stSkipped} value={p.skipped} />
                </div>
              </div>
            ))}
          </div>
        ))}
    </section>
  );
}

function Row({ label, value, warn }: Readonly<{ label: string; value: string | number; warn?: boolean }>) {
  return (
    <span className="flex items-baseline gap-2 font-body text-[13px]">
      <span className="flex-1 min-w-0 truncate text-muted">{label}</span>
      <b className={cn("font-display font-extrabold tabular-nums", warn ? "text-red-pale" : "text-cream")}>{value}</b>
    </span>
  );
}
