/**
 * Turn-by-turn shot logging. The app knows whose turn it is (A1 → B1 → A2 →
 * B2, drag to reorder), so a throw is one tap: where did the cap end up.
 * Tap another name to log an out-of-turn throw (a defense — it uses that
 * player's cap for the round). A cap in someone's shooting box gives that
 * player an extra throw at the end of the round. Caps moved by a throw are
 * optional and count for the thrower.
 */
"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import type { Duo } from "@/lib/teams";

type Hit = "1" | "2" | "3" | "mama" | "miss";
type Logged = { playerId: string; key: string };
type State = {
  order: string[];
  used: string[];
  bonus: string[];
  sel: string;
  round: number;
  last: string | null;
  /** Events of finished rounds, and of the round in progress. */
  rounds: Logged[][];
  cur: Logged[];
};

const SIP_VALUE: Record<string, number> = { "1": 1, "2": 2, "3": 3 };

/** Drinking for one round, settled after its last throw: whoever caused a
 * landing in 1/2/3 drinks that many sips (own goals too). A mama means that
 * thrower empties their pint and nobody takes sips that round. */
function settle(events: Logged[]): { sips: Record<string, number>; mamas: string[] } {
  const hit = (k: string) => (k.includes(":") ? k.slice(2) : k);
  const mamas = [...new Set(events.filter((e) => hit(e.key) === "mama").map((e) => e.playerId))];
  if (mamas.length > 0) return { sips: {}, mamas };
  const sips: Record<string, number> = {};
  for (const e of events) {
    const v = SIP_VALUE[hit(e.key)] ?? 0;
    if (v) sips[e.playerId] = (sips[e.playerId] ?? 0) + v;
  }
  return { sips, mamas };
}

/** A1, B1, (C1, D1,) A2, B2, … */
function interleave(teams: Duo[]): string[] {
  const max = Math.max(...teams.map((t) => t.players.length));
  const out: string[] = [];
  for (let i = 0; i < max; i++) for (const t of teams) if (t.players[i]) out.push(t.players[i].id);
  return out;
}

function nextUp(s: Pick<State, "order" | "used" | "bonus">): string | null {
  return s.order.find((id) => !s.used.includes(id)) ?? s.bonus[0] ?? null;
}

export function TurnLogger({
  teams,
  names,
  onLog,
  onUnlog,
}: Readonly<{
  teams: Duo[];
  names: Record<string, string>;
  onLog: (playerId: string, key: string) => void;
  onUnlog: (playerId: string, key: string) => void;
}>) {
  const { t } = useT();
  const [s, setS] = useState<State>(() => {
    const order = interleave(teams);
    return { order, used: [], bonus: [], sel: order[0], round: 1, last: null, rounds: [], cur: [] };
  });
  const [history, setHistory] = useState<{ prev: State; logged: Logged[] }[]>([]);
  const [panel, setPanel] = useState<null | "vak" | "moved">(null);
  const dragId = useRef<string | null>(null);

  const teamOf = (id: string) => teams.findIndex((x) => x.players.some((p) => p.id === id));
  const slotLabel = (id: string) => {
    const ti = teamOf(id);
    const n = s.order.filter((x) => teamOf(x) === ti).indexOf(id) + 1;
    return `${String.fromCharCode(65 + ti)}${n}`;
  };
  const expected = nextUp(s);
  const isBonusThrow = s.order.every((id) => s.used.includes(id)) && s.bonus.includes(s.sel);

  function commit(next: State, logged: Logged[]) {
    for (const l of logged) onLog(l.playerId, l.key);
    setHistory((h) => [...h, { prev: s, logged }]);
    setS(next);
    setPanel(null);
  }

  function advance(base: State): State {
    const up = nextUp(base);
    if (up) return { ...base, sel: up };
    return { ...base, used: [], bonus: [], round: base.round + 1, sel: base.order[0], rounds: [...base.rounds, base.cur], cur: [] };
  }

  /** Thrower's own cap ended in `hit`; `vakOf` = it ended in that player's shooting box. */
  function throwCap(hit: Hit, vakOf?: string) {
    const id = s.sel;
    let used = s.used;
    let bonus = s.bonus;
    if (!used.includes(id)) used = [...used, id];
    else if (bonus.includes(id)) bonus = bonus.filter((x, i) => i !== bonus.indexOf(id));
    if (vakOf) bonus = [...bonus, vakOf];
    const ev = { playerId: id, key: hit };
    commit(advance({ ...s, used, bonus, last: id, cur: [...s.cur, ev] }), [ev]);
  }

  function moved(key: string) {
    if (!s.last) return;
    const ev = { playerId: s.last, key };
    // The round may have just closed on that throw — the moved cap still belongs to it.
    const next =
      s.cur.length === 0 && s.rounds.length > 0
        ? { ...s, rounds: [...s.rounds.slice(0, -1), [...s.rounds[s.rounds.length - 1], ev]] }
        : { ...s, cur: [...s.cur, ev] };
    commit(next, [ev]);
  }

  function undo() {
    const top = history.at(-1);
    if (!top) return;
    for (const l of top.logged) onUnlog(l.playerId, l.key);
    setHistory((h) => h.slice(0, -1));
    setS(top.prev);
    setPanel(null);
  }

  function pick(id: string) {
    const canThrow = !s.used.includes(id) || s.bonus.includes(id);
    if (canThrow) setS((cur) => ({ ...cur, sel: id }));
  }

  // Pointer-based drag so it works with touch too.
  function onPointerDown(e: React.PointerEvent, id: string) {
    dragId.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const from = dragId.current;
    if (!from) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-turn-id]");
    const over = el?.dataset.turnId;
    if (!over || over === from) return;
    setS((cur) => {
      const order = cur.order.filter((x) => x !== from);
      order.splice(cur.order.indexOf(over), 0, from);
      const reordered = { ...cur, order };
      return cur.used.length === 0 ? { ...reordered, sel: order[0] } : reordered;
    });
  }
  function onPointerUp() {
    dragId.current = null;
  }

  const lastRound = s.rounds.length > 0 ? settle(s.rounds[s.rounds.length - 1]) : null;
  const live = settle(s.cur);
  const totals: Record<string, { sips: number; ad: number }> = {};
  for (const r of s.rounds) {
    const d = settle(r);
    for (const [id, n] of Object.entries(d.sips)) totals[id] = { sips: (totals[id]?.sips ?? 0) + n, ad: totals[id]?.ad ?? 0 };
    for (const id of d.mamas) totals[id] = { sips: totals[id]?.sips ?? 0, ad: (totals[id]?.ad ?? 0) + 1 };
  }
  const sipsLabel = (n: number) => (n === 1 ? t.log.sipsOne : format(t.log.sipsN, { n }));
  const selName = names[s.sel] ?? "";
  const lastName = s.last ? (names[s.last] ?? "") : "";
  const status = isBonusThrow ? t.log.turnBonus : s.sel === expected ? t.log.turnUp : t.log.turnOut;

  return (
    <div className="rounded-[16px] bg-surface-deep border border-line p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-heading font-bold text-[13px] tracking-[0.12em] uppercase text-muted">{format(t.log.turnRound, { n: s.round })}</span>
        {history.length > 0 && (
          <button type="button" onClick={undo} className="h-8 px-3 rounded-pill bg-surface-panel border border-line font-body font-semibold text-xs text-cream">
            ↺ {t.log.undo}
          </button>
        )}
      </div>

      {lastRound && s.cur.length === 0 && (
        <div className="rounded-md bg-amber/12 border border-amber/50 p-3 flex flex-col gap-1.5">
          <span className="font-heading font-bold text-[13px] tracking-[0.1em] uppercase text-gold">{format(t.log.drinkTitle, { n: s.round - 1 })}</span>
          {lastRound.mamas.length > 0 ? (
            <>
              {lastRound.mamas.map((id) => (
                <span key={id} className="font-body font-semibold text-[15px] text-red-pale">
                  {format(t.log.drinkMama, { name: names[id] })}
                </span>
              ))}
              <span className="font-body text-xs text-muted">{t.log.drinkMamaNoSips}</span>
            </>
          ) : Object.keys(lastRound.sips).length === 0 ? (
            <span className="font-body text-sm text-muted">{t.log.drinkNone}</span>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {s.order
                .filter((id) => lastRound.sips[id])
                .map((id) => (
                  <span key={id} className="font-body text-[15px] flex justify-between gap-2">
                    <span className="truncate">{names[id]}</span>
                    <span className="font-display font-extrabold text-gold">{sipsLabel(lastRound.sips[id])}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
      {s.cur.length > 0 && (live.mamas.length > 0 || Object.keys(live.sips).length > 0) && (
        <span className="font-body text-xs text-muted">
          {t.log.drinkSoFar}{" "}
          {live.mamas.length > 0
            ? live.mamas.map((id) => `${names[id]} M`).join(" · ")
            : s.order.filter((id) => live.sips[id]).map((id) => `${names[id]} ${live.sips[id]}`).join(" · ")}
        </span>
      )}

      <div className="flex flex-col gap-1">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(s.order.length, 4)}, minmax(0, 1fr))` }}>
          {s.order.map((id) => {
            const spent = s.used.includes(id) && !s.bonus.includes(id);
            const on = id === s.sel;
            return (
              <button
                key={id}
                type="button"
                data-turn-id={id}
                onClick={() => pick(id)}
                onPointerDown={(e) => onPointerDown(e, id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cn(
                  "touch-none select-none h-12 rounded-md flex flex-col items-center justify-center leading-tight px-1",
                  on ? "bg-amber text-ink" : spent ? "border border-dashed border-line text-muted line-through" : "bg-surface-raised border border-line text-cream",
                )}
              >
                <span className="font-heading font-bold text-[11px] tracking-[0.08em]">
                  {slotLabel(id)}
                  {s.bonus.includes(id) && " +1"}
                </span>
                <span className="font-body font-semibold text-[13px] truncate max-w-full">{names[id]}</span>
              </button>
            );
          })}
        </div>
        <span className="font-body text-[11px] text-muted px-0.5">{t.log.turnDrag}</span>
      </div>

      <div className="text-center flex flex-col">
        <span className={cn("font-body text-xs", s.sel === expected && !isBonusThrow ? "text-muted" : "text-gold")}>{status}</span>
        <span className="font-display font-extrabold text-[30px] leading-none uppercase">{selName}</span>
        <span className="font-body text-[11px] text-muted mt-1">{t.log.turnTapOther}</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {(["1", "2", "3", "mama", "miss"] as const).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => throwCap(h)}
            className={cn(
              "h-14 rounded-md border font-display font-extrabold text-xl",
              h === "mama" ? "border-red/50 bg-red/13 text-red-pale" : h === "miss" ? "border-line bg-surface-raised text-muted text-base" : "border-line-strong bg-surface-raised text-cream",
            )}
          >
            {h === "mama" ? "M" : h === "miss" ? t.log.miss : h}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPanel(panel === "vak" ? null : "vak")}
        aria-expanded={panel === "vak"}
        className={cn("h-10 rounded-md border font-body font-semibold text-sm", panel === "vak" ? "border-gold bg-gold/15 text-gold" : "border-line bg-surface-raised text-cream")}
      >
        {t.log.turnInVak}
      </button>
      {panel === "vak" && (
        <div className="flex flex-col gap-1.5">
          <span className="font-body text-xs text-muted">{t.log.turnWhoseVak}</span>
          <div className="grid grid-cols-4 gap-1.5">
            {s.order
              .filter((id) => id !== s.sel)
              .map((id) => (
                <button key={id} type="button" onClick={() => throwCap("miss", id)} className="h-10 rounded-md bg-surface-raised border border-line font-body font-semibold text-[13px] text-cream truncate px-1">
                  {names[id]}
                </button>
              ))}
          </div>
        </div>
      )}

      {s.rounds.length > 0 && Object.keys(totals).length > 0 && (
        <div className="border-t border-line pt-2 flex flex-col gap-1">
          <span className="font-heading font-semibold text-[11px] tracking-[0.12em] uppercase text-muted">{t.log.drinkTotal}</span>
          <span className="font-body text-xs text-cream/90">
            {s.order
              .filter((id) => totals[id])
              .map((id) => `${names[id]} ${sipsLabel(totals[id].sips)}${totals[id].ad ? ` + ${totals[id].ad}× AF` : ""}`)
              .join(" · ")}
          </span>
        </div>
      )}

      {s.last && (
        <>
          <button
            type="button"
            onClick={() => setPanel(panel === "moved" ? null : "moved")}
            aria-expanded={panel === "moved"}
            className="self-start font-body font-semibold text-xs text-muted underline underline-offset-2"
          >
            {format(t.log.turnMoved, { name: lastName })}
          </button>
          {panel === "moved" && (
            <div className="rounded-md bg-surface-raised border border-gold/40 p-2.5 flex flex-col gap-1.5">
              <span className="font-body text-xs text-gold">{format(t.log.turnMovedHint, { name: lastName })}</span>
              {teams.map((team, ti) => {
                const own = ti === teamOf(s.last!);
                const prefix = own ? "d" : "o";
                return (
                  <div key={team.id} className="flex flex-col gap-1">
                    <span className={cn("font-body font-semibold text-xs truncate", own ? "text-cream" : "text-red-pale")}>
                      {format(t.log.pointsFor, { names: team.players.map((p) => names[p.id]).join(" & ") })}
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {(["1", "2", "3", "mama"] as const).map((h) => (
                        <button key={h} type="button" onClick={() => moved(`${prefix}:${h}`)} className="h-9 rounded-sm bg-surface-deep border border-line font-display font-extrabold text-sm text-cream">
                          {h === "mama" ? "M" : h}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={() => moved("d:miss")} className="h-9 rounded-sm bg-surface-deep border border-line font-body font-semibold text-xs text-cream">
                {t.log.turnMovedOff}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
