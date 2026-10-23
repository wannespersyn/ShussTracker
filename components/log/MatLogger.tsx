/**
 * Beta mat logger: full-screen, the mat from above in the middle. Each turn you
 * drag the thrower's cap to where it landed (and any caps it knocked), tap
 * "Throw done", and the app follows the turn order, extra throws from shooting
 * boxes and the drinking per round. The game ends when a team has emptied its
 * pints; everything (every cap move) is handed to `onSave` as a MatGameLog.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import type { Duo } from "@/lib/teams";
import {
  BOTTLES, CORNERS, MAMAS, ZONES,
  dropCap, finishThrow, mamaTeam, newMatState, nextRound, placeA1, spotOf, teamOfSlot, toGameLog, turnInfo, zoneTeam,
  type Corner, type MatGameLog, type MatState, type Slot, type Spot,
} from "@/lib/mat";

const HELP_KEY = "shuss.matHelpHidden";
const TEAM_FILL = ["#EFE7D3", "#5FB7FF"];
const TEAM_STROKE = ["#C9A55A", "#2f6fa3"];
const TEAM_DOT = ["bg-[#EFE7D3]", "bg-[#5FB7FF]"];

export function MatLogger({
  teams,
  names,
  saving,
  onSave,
  onClose,
}: Readonly<{
  teams: Duo[];
  names: Record<string, string>;
  saving?: boolean;
  onSave: (log: MatGameLog) => void;
  onClose: () => void;
}>) {
  const { t } = useT();
  const M = t.mat;
  const solo = teams[0].players.length === 1;
  const [st, setSt] = useState<MatState>(() => newMatState(solo));
  const [history, setHistory] = useState<MatState[]>([]);
  const [slots, setSlots] = useState<Record<Slot, string | undefined>>({
    a1: teams[0].players[0]?.id, a2: teams[0].players[1]?.id, b1: teams[1].players[0]?.id, b2: teams[1].players[1]?.id,
  });
  // Opens on the explainer unless the player chose "don't show again" (only mounted client-side, mid-flow).
  const [dialog, setDialog] = useState<null | "help" | "setup" | "pints" | "end">(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(HELP_KEY) === "1" ? null : "help"; } catch { return "help"; }
  });
  const [winner, setWinner] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const drag = useRef<{ no: number; dx: number; dy: number } | null>(null);

  const nameOf = (s: Slot) => names[slots[s] ?? ""] ?? s.toUpperCase();
  const teamName = (ti: number) => (ti === 0 ? ["a1", "a2"] : ["b1", "b2"]).filter((s) => slots[s as Slot]).map((s) => nameOf(s as Slot)).join(" & ");

  /** Apply a mutation on a copy, remembering the previous state for undo. */
  function apply(fn: (draft: MatState) => boolean | void, remember = true) {
    const draft = structuredClone(st);
    if (fn(draft) === false) return;
    if (remember) setHistory((h) => [...h, st]);
    setSt(draft);
  }
  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setSt(prev);
  };

  /* ---------- labels ---------- */
  const spotLabel = (s: Spot, short = false) => {
    const forTeam = (ti: number) => (short ? format(M.forTeamShort, { t: "AB"[ti] }) : format(M.forTeam, { team: teamName(ti) }));
    switch (s.kind) {
      case "zone": return format(M.spotZone, { v: s.v }) + " " + forTeam(zoneTeam(st, s.id));
      case "mama": return M.spotMama + " " + forTeam(mamaTeam(st, s.id));
      case "box": return format(M.spotBox, { name: nameOf(s.slot) });
      case "off": return M.spotOff;
      case "none": return M.spotNone;
      default: return M.spotWaiting;
    }
  };
  const codeLabel = (code: string) => {
    if (code === "miss") return M.miss.toLowerCase();
    const z = ZONES.find((x) => x.id === code);
    if (z) return spotLabel({ kind: "zone", id: z.id, v: z.v });
    if (code === "ML" || code === "MR") return spotLabel({ kind: "mama", id: code });
    if (code.startsWith("box:")) return spotLabel({ kind: "box", slot: code.slice(4) as Slot });
    return code === "off" ? M.spotOff : code === "none" ? M.spotNone : M.spotWaiting;
  };

  /* ---------- totals ---------- */
  const totals = useMemo(() => {
    const tot = [{ sips: 0, af: 0 }, { sips: 0, af: 0 }];
    for (const r of st.results) { r.sips.forEach((n, ti) => (tot[ti].sips += n)); for (const ti of r.mamaTeams) tot[ti].af++; }
    return tot;
  }, [st.results]);

  /* ---------- dragging ---------- */
  function toLocal(e: React.PointerEvent) {
    const pt = svgRef.current!.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(gRef.current!.getScreenCTM()!.inverse());
  }
  function onCapDown(e: React.PointerEvent, no: number) {
    if (st.phase !== "throw") return;
    const c = st.caps.find((x) => x.no === no)!;
    const p = toLocal(e);
    drag.current = { no, dx: c.x - p.x, dy: c.y - p.y };
    svgRef.current!.setPointerCapture(e.pointerId);
    setHistory((h) => [...h, st]);
    e.preventDefault();
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toLocal(e);
    setSt((cur) => ({ ...cur, caps: cur.caps.map((c) => (c.no === d.no ? { ...c, x: Math.round(p.x + d.dx), y: Math.round(p.y + d.dy), waiting: false } : c)) }));
  }
  function onUp() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setSt((cur) => { const draft = structuredClone(cur); dropCap(draft, d.no); return draft; });
  }

  /* ---------- end of game ---------- */
  function save() {
    if (winner === null) return;
    onSave(toGameLog(st, slots, winner));
  }

  /* ---------- render ---------- */
  const inf = turnInfo(st);
  const active = st.phase === "throw" ? st.thrower : null;
  const myCap = st.caps.find((c) => c.no === st.activeCap);
  const placed = Boolean(myCap && !myCap.waiting);
  const lastResult = st.results.at(-1);
  const sips = (n: number) => (n === 1 ? M.sipsOne : format(M.sipsN, { n }));
  const label = (txt: string | number, x: number, y: number, props: React.SVGProps<SVGTextElement> = {}) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--font-display)" }} fontWeight={800} transform={`rotate(-90 ${x} ${y})`} {...props}>
      {txt}
    </text>
  );

  const awards = useMemo(() => {
    const per = {} as Record<Slot, { three: number; mama: number; knocks: number; miss: number }>;
    for (const s of st.order) per[s] = { three: 0, mama: 0, knocks: 0, miss: 0 };
    for (const th of st.throws) {
      if (th.kind === "skipped") continue;
      const x = per[th.slot];
      if (th.firstSpot && ZONES.find((z) => z.id === th.firstSpot)?.v === 3) x.three++;
      if (th.firstSpot === "ML" || th.firstSpot === "MR") x.mama++;
      if (th.missed || th.firstSpot === "off") x.miss++;
      x.knocks += th.moves.filter((m) => !m.isThrownCap && teamOfSlot(m.owner) !== teamOfSlot(th.slot)).length;
    }
    return ([["three", M.awThree, "🎯"], ["knocks", M.awKnocks, "💥"], ["mama", M.awMama, "🔴"], ["miss", M.awMiss, "🙈"]] as const)
      .map(([k, txt, icon]) => {
        const best = st.order.slice().sort((a, b) => per[b][k] - per[a][k])[0];
        return per[best][k] > 0 ? { icon, txt, name: nameOf(best), n: per[best][k] } : null;
      })
      .filter(Boolean) as { icon: string; txt: string; name: string; n: number }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.throws, slots]);

  return (
    <div className="fixed inset-0 z-[60] bg-surface overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[480px] h-dvh grid grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 px-3 py-2.5">
        {/* top bar */}
        <header className="flex items-center gap-1.5 min-w-0">
          <button type="button" onClick={onClose} aria-label={M.close} className="w-9 h-9 shrink-0 rounded-pill bg-surface-raised border border-line text-cream flex items-center justify-center">✕</button>
          <span className="font-display font-extrabold text-xl uppercase leading-none whitespace-nowrap">
            {M.round} <span className="text-gold">{st.round}</span>
          </span>
          <span className="ml-auto flex gap-1.5 min-w-0">
            {[0, 1].map((ti) => (
              <span key={ti} title={teamName(ti)} className="h-8 px-2 rounded-pill bg-surface-raised border border-line flex items-center gap-1.5 font-display font-extrabold text-lg tabular-nums">
                <span className={cn("w-2.5 h-2.5 rounded-full", TEAM_DOT[ti])} />
                {totals[ti].sips}
                {totals[ti].af > 0 && <small className="font-body font-semibold text-[11px] text-red-pale">{totals[ti].af}×M</small>}
              </span>
            ))}
          </span>
          {history.length > 0 && (
            <button type="button" onClick={undo} aria-label={M.undo} className="w-9 h-9 shrink-0 rounded-pill bg-surface-raised border border-line text-cream flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            </button>
          )}
          <button type="button" onClick={() => setDialog("pints")} aria-label={M.pintsBtn} className="w-9 h-9 shrink-0 rounded-pill bg-amber/15 border border-amber/50 flex items-center justify-center text-[17px]">🍺</button>
          <button type="button" onClick={() => setDialog("setup")} aria-label={M.lineup} className="w-9 h-9 shrink-0 rounded-pill bg-surface-raised border border-line text-cream flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" /></svg>
          </button>
          <button type="button" onClick={() => setDialog("help")} aria-label={M.help} className="w-9 h-9 shrink-0 rounded-pill bg-surface-raised border border-line text-cream font-bold">?</button>
        </header>

        {/* turn strip */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${st.order.length}, minmax(0, 1fr))` }}>
          {st.order.map((s) => {
            const spent = inf.count[s] >= inf.allowed[s] && s !== active;
            const plus = inf.allowed[s] > 1 && inf.count[s] < inf.allowed[s] ? "+1" : "";
            return (
              <div key={s} className={cn("h-9 rounded-[10px] border flex items-center justify-center gap-1 px-1.5 min-w-0 text-[13px]", s === active ? "bg-amber border-amber text-ink" : spent ? "border-dashed border-line text-muted" : "bg-surface-raised border-line text-cream")}>
                <b className={cn("font-display font-extrabold shrink-0", s === active ? "text-ink" : "text-muted")}>{s.toUpperCase()}{plus}</b>
                <span className={cn("truncate font-body font-semibold", spent && "line-through")}>{nameOf(s)}</span>
              </div>
            );
          })}
        </div>

        {/* the mat */}
        <div className="min-h-0 flex items-center justify-center">
          <svg
            ref={svgRef}
            viewBox="0 -22 265 868"
            className="h-full w-auto max-w-full touch-none select-none overflow-visible"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="img"
            aria-label={M.matAlt}
          >
            <g ref={gRef} transform="translate(265 0) rotate(90)">
              <rect x={28} y={10} width={768} height={245} rx={16} fill="#0E1012" stroke="#E0A43A" strokeWidth={6} />
              <rect x={36} y={18} width={752} height={229} rx={10} fill="none" stroke="#1E2124" strokeWidth={2} />
              {MAMAS.map((m) => <rect key={m.id} x={m.x} y={m.y} width={m.w} height={m.h} fill="#E3101E" />)}
              {ZONES.map((z) => {
                const cx = z.pts.reduce((a, p) => a + p[0], 0) / z.pts.length, cy = z.pts.reduce((a, p) => a + p[1], 0) / z.pts.length;
                return (
                  <g key={z.id}>
                    <polygon points={z.pts.map((p) => p.join(",")).join(" ")} fill="#E0A43A" />
                    {label(z.v, cx, cy, { fill: "#3a2706", fontSize: 30, opacity: 0.5 })}
                  </g>
                );
              })}
              {BOTTLES.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={19} fill="#4A2A1C" stroke="#2A160E" strokeWidth={3} />)}
              {st.order.map((s) => {
                const pts = CORNERS[st.corner[s]!].pts;
                const cx = (pts[0][0] * 2 + pts[1][0] + pts[2][0]) / 4, cy = (pts[0][1] * 2 + pts[1][1] + pts[2][1]) / 4;
                return (
                  <g key={s}>
                    <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="#E0A43A" />
                    {!st.caps.some((c) => c.waiting && c.owner === s) && label(s.toUpperCase(), cx, cy, { fill: "#3a2706", fontSize: 13 })}
                  </g>
                );
              })}
              {st.caps.map((c) => {
                const sp = spotOf(st, c);
                const ti = sp.kind === "zone" ? zoneTeam(st, sp.id) : sp.kind === "mama" ? mamaTeam(st, sp.id) : teamOfSlot(c.owner);
                const isActive = st.phase === "throw" && c.no === st.activeCap;
                return (
                  <g key={c.no} transform={`translate(${c.x} ${c.y})`} onPointerDown={(e) => onCapDown(e, c.no)} className="cursor-grab">
                    <circle r={30} fill="transparent" />
                    {isActive && <circle r={25} fill="none" stroke="#E0A43A" strokeWidth={3.5} strokeDasharray="5 5" />}
                    {sp.kind === "mama" ? (
                      <>
                        <circle r={22} fill="none" stroke={TEAM_FILL[ti]} strokeWidth={3} className="motion-safe:animate-[matRing_1s_ease-out_infinite] [transform-box:fill-box] origin-center" />
                        <circle r={16} strokeWidth={3} className="fill-[#ff2a36] stroke-white motion-safe:animate-[matFlick_0.5s_steps(1,end)_infinite]" />
                      </>
                    ) : (
                      <circle r={16} fill={TEAM_FILL[ti]} stroke={TEAM_STROKE[ti]} strokeWidth={3} />
                    )}
                    <text textAnchor="middle" dominantBaseline="central" fill="#14100a" style={{ fontFamily: "var(--font-display)" }} fontWeight={800} fontSize={15} transform="rotate(-90)">
                      {c.owner.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* dock */}
        <footer className="rounded-[18px] bg-surface-deep border border-line p-3 flex flex-col gap-2.5">
          {st.phase === "done" && lastResult ? (
            <>
              <span className="font-display font-extrabold text-xl uppercase tracking-[0.04em] text-gold">{format(M.drinkTitle, { n: lastResult.round })}</span>
              {lastResult.mamaTeams.length ? (
                <>
                  {lastResult.mamaTeams.map((ti) => <span key={ti} className="font-body font-bold text-base text-red-pale">{format(M.mamaLine, { team: teamName(ti) })}</span>)}
                  <span className="font-body text-xs text-muted">{M.mamaNoSips}</span>
                </>
              ) : (
                [0, 1].map((ti) => (
                  <div key={ti} className="flex items-center gap-2 font-body text-base">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", TEAM_DOT[ti])} />
                    <span className="flex-1 min-w-0 truncate">{teamName(ti)}</span>
                    <b className="font-display font-extrabold text-2xl text-gold whitespace-nowrap">{sips(lastResult.sips[ti])}</b>
                  </div>
                ))
              )}
              <button type="button" onClick={() => apply((d) => nextRound(d))} className="h-12.5 rounded-[14px] bg-amber text-ink font-display font-extrabold text-[19px] tracking-[0.06em] uppercase">
                {M.nextRound}
              </button>
            </>
          ) : active && myCap ? (
            <>
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span className={cn("font-display font-extrabold text-sm px-1.5 py-0.5 rounded-[6px] text-ink shrink-0", TEAM_DOT[teamOfSlot(active)])}>{active.toUpperCase()}</span>
                <span className="font-display font-extrabold text-[30px] leading-none uppercase truncate min-w-0">{nameOf(active)}</span>
                <span className="ml-auto font-body text-[13px] text-muted whitespace-nowrap">
                  {M.cap}: <b className="text-cream font-semibold">{spotLabel(spotOf(st, myCap), true)}</b>
                </span>
              </div>
              <span className={cn("font-body text-xs -mt-1.5", inf.count[active] >= 1 ? "text-gold" : "text-muted")}>
                {inf.count[active] >= 1 ? M.bonusHint : placed ? M.movedHint : M.dropHint}
              </span>
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" onClick={() => apply((d) => finishThrow(d, true))} className="h-12.5 rounded-[14px] bg-surface-raised border border-line-strong font-display font-bold text-[17px] tracking-[0.04em] uppercase">
                  {M.miss}
                </button>
                <button
                  type="button"
                  aria-disabled={!placed}
                  onClick={() => placed && apply((d) => finishThrow(d, false))}
                  className={cn("h-12.5 rounded-[14px] bg-amber text-ink font-display font-extrabold text-[19px] tracking-[0.06em] uppercase", !placed && "opacity-40")}
                >
                  {M.done}
                </button>
              </div>
            </>
          ) : null}
        </footer>
      </div>

      {/* log, below the fold */}
      <div className="mx-auto max-w-[480px] px-3 pb-10 flex flex-col gap-2.5">
        <div className="rounded-[18px] bg-surface-deep border border-line p-3.5 flex flex-col gap-3">
          <button type="button" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} className="flex items-baseline gap-2.5 text-left">
            <span className="font-heading font-bold text-[13px] tracking-[0.14em] uppercase text-muted">{M.log}</span>
            <span className="font-body text-xs text-muted">{format(M.logCount, { n: st.throws.length, r: st.results.length })}</span>
            <span className={cn("ml-auto text-muted transition-transform", logOpen && "rotate-180")}>▾</span>
          </button>
          {logOpen &&
            Array.from({ length: st.round }, (_, i) => st.round - i).map((r) => {
              const th = st.throws.filter((x) => x.round === r);
              if (!th.length) return null;
              return (
                <div key={r} className="flex flex-col gap-1">
                  <span className="font-heading font-bold text-[12px] tracking-[0.14em] uppercase text-muted">{M.round} {r}</span>
                  {th.map((x, i) => (
                    <div key={i} className="flex items-baseline gap-2.5 px-2.5 py-2 rounded-[10px] bg-surface-raised border border-line font-body text-sm">
                      <span className="w-6 shrink-0 font-heading font-bold text-xs text-muted">{x.slot.toUpperCase()}</span>
                      <span className="flex-1 min-w-0">
                        {nameOf(x.slot)}
                        {x.moves.filter((m) => !m.isThrownCap).map((m, j) => (
                          <small key={j} className="block text-xs text-muted">{format(M.knocked, { name: nameOf(m.owner), to: codeLabel(m.to.spot) })}</small>
                        ))}
                      </span>
                      <span className="font-display font-extrabold whitespace-nowrap">
                        {x.kind === "skipped" ? (x.skipReason === "cap_knocked" ? M.skipKnocked : M.skipBox) : codeLabel(x.firstSpot ?? "none")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      </div>

      {/* sheets */}
      {dialog && (
        <div className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center p-3" onClick={(e) => e.target === e.currentTarget && dialog !== "end" && setDialog(null)}>
          <div role="dialog" aria-modal="true" className="relative w-full max-w-[440px] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[20px] bg-surface-raised border border-line p-4.5 flex flex-col gap-3.5">
            {dialog === "help" && (
              <>
                <h2 className="font-display font-extrabold text-[28px] leading-none uppercase">{M.helpTitle}</h2>
                {[["1", M.help1], ["2", M.help2], ["3", M.help3], ["+1", M.help4], ["🍺", M.help5]].map(([ic, txt]) => (
                  <div key={ic} className="flex gap-3 items-start font-body text-sm leading-[1.45]">
                    <span className="shrink-0 w-9.5 h-7 rounded-pill bg-surface-panel border border-line text-gold flex items-center justify-center font-display font-extrabold text-[13px]">{ic}</span>
                    <span>{txt}</span>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { try { localStorage.setItem(HELP_KEY, "1"); } catch { /* ignore */ } setDialog(null); }} className="h-11 rounded-[12px] bg-surface-panel border border-line font-display font-bold uppercase tracking-[0.04em]">{M.helpHide}</button>
                  <button type="button" onClick={() => setDialog(null)} className="h-11 rounded-[12px] bg-amber text-ink font-display font-extrabold uppercase tracking-[0.04em]">{M.helpOk}</button>
                </div>
              </>
            )}

            {dialog === "setup" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-[28px] leading-none uppercase">{M.lineup}</h2>
                  <button type="button" onClick={() => setDialog(null)} aria-label={M.close} className="w-9 h-9 rounded-pill bg-surface-panel border border-line">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-2 rounded-[14px] border-[3px] border-gold bg-[#0e1012]">
                  {(["TL", "TR", "BL", "BR"] as Corner[]).map((k, i) => {
                    const s = st.order.find((x) => st.corner[x] === k);
                    return (
                      <span key={k} className="contents">
                        {i === 2 && <span className="col-span-2 text-center font-body text-[11px] text-muted py-1.5">mama · 3 · 2 · 1 | 1 · 2 · 3 · mama</span>}
                        <button type="button" onClick={() => apply((d) => placeA1(d, k), false)} className="h-10.5 rounded-[10px] bg-surface-raised border border-line font-body text-[13px] flex items-center gap-1.5 px-2 min-w-0">
                          {s ? (<><span className={cn("w-2.5 h-2.5 rounded-full shrink-0", TEAM_DOT[teamOfSlot(s)])} /><b className="font-display font-extrabold">{s.toUpperCase()}</b><span className="truncate">{nameOf(s)}</span></>) : <span className="text-muted">—</span>}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <span className="font-body text-xs text-muted">{M.lineupHint}</span>
                {!solo && (
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((ti) => (
                      <button
                        key={ti}
                        type="button"
                        onClick={() => setSlots((cur) => (ti === 0 ? { ...cur, a1: cur.a2, a2: cur.a1 } : { ...cur, b1: cur.b2, b2: cur.b1 }))}
                        className="h-10 rounded-[12px] bg-surface-panel border border-line font-body font-semibold text-[13px]"
                      >
                        ⇄ {ti === 0 ? "A1 / A2" : "B1 / B2"}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {dialog === "pints" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-[28px] leading-none uppercase">{M.pintsTitle}</h2>
                  <button type="button" onClick={() => setDialog(null)} aria-label={M.close} className="w-9 h-9 rounded-pill bg-surface-panel border border-line">✕</button>
                </div>
                <span className="font-body text-xs text-muted">{M.pintsSub}</span>
                {[0, 1].map((ti) => (
                  <button key={ti} type="button" onClick={() => { setWinner(ti); setDialog("end"); }} className="min-h-16 rounded-[14px] bg-surface-panel border border-line-strong flex items-center gap-3 px-4 text-left font-display font-extrabold text-[22px] uppercase">
                    <span className={cn("w-4 h-4 rounded-full shrink-0", TEAM_DOT[ti])} />
                    {teamName(ti)}
                  </button>
                ))}
              </>
            )}

            {dialog === "end" && winner !== null && (
              <>
                <div className="text-center flex flex-col gap-1 pt-1">
                  <span className="text-[40px] leading-none">👑</span>
                  <span className="font-display font-bold text-sm tracking-[0.16em] uppercase text-gold">{M.won}</span>
                  <span className="font-display font-extrabold text-[40px] leading-[0.95] uppercase text-balance">{teamName(winner)}</span>
                  <span className="font-body text-[13px] text-muted">{format(st.results.length === 1 ? M.roundsOne : M.roundsN, { n: st.results.length })}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((ti) => (
                    <div key={ti} className={cn("rounded-[12px] bg-surface-panel border p-2.5 flex flex-col gap-0.5 min-w-0", ti === winner ? "border-gold" : "border-line")}>
                      <span className="font-body text-xs text-muted flex items-center gap-1.5 truncate"><span className={cn("w-2.5 h-2.5 rounded-full shrink-0", TEAM_DOT[ti])} />{teamName(ti)}</span>
                      <span className="font-display font-extrabold text-[30px] leading-none tabular-nums">{totals[ti].sips}</span>
                      <span className="font-body text-xs text-muted">{M.sipsLabel}</span>
                      {totals[ti].af > 0 && <span className="font-body text-xs text-red-pale">{totals[ti].af}× mama</span>}
                    </div>
                  ))}
                </div>
                {awards.length > 0 && (
                  <>
                    <span className="font-heading font-bold text-[13px] tracking-[0.14em] uppercase text-muted">{M.highlights}</span>
                    {awards.map((a) => (
                      <div key={a.txt} className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] bg-surface-panel border border-line font-body text-sm">
                        <span className="w-7 text-center text-lg">{a.icon}</span>
                        <span className="flex-1 min-w-0">{a.name}<small className="block text-xs text-muted">{a.txt}</small></span>
                        <b className="font-display font-extrabold text-lg text-gold">{a.n}×</b>
                      </div>
                    ))}
                  </>
                )}
                <button type="button" disabled={saving} onClick={save} className="h-12.5 rounded-[14px] bg-amber text-ink font-display font-extrabold text-[19px] tracking-[0.06em] uppercase disabled:opacity-60">
                  {saving ? M.saving : M.save}
                </button>
                <button type="button" disabled={saving} onClick={() => { setWinner(null); setDialog(null); }} className="h-10 rounded-[12px] bg-surface-panel border border-line font-display font-bold uppercase tracking-[0.04em] text-sm">
                  {M.keepPlaying}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
