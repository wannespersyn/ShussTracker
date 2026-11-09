/**
 * StatsPage
 *
 * The player-built stats page ("Shussapp Stats" design): swipeable screens
 * of blocks, one crew / player / period filter for all of them, and an edit
 * mode to rename screens, drag blocks around, change their size (S/M/L),
 * remove them, add blocks from the library and add new screens from a
 * template.
 *
 * Data: one StatsExplorerData payload + the saved layout (or the default);
 * changes are saved with saveStatsLayoutAction.
 * Notes: copy lives in t.sb; blocks in StatsBlocks.tsx; numbers in lib/stats-scope.ts.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { StatsExplorerData } from "@/lib/db/stats";
import {
  BLOCK_KINDS,
  BLOCKS,
  MAX_BLOCKS,
  MAX_SCREEN_NAME,
  MAX_SCREENS,
  TEMPLATES,
  blocksFrom,
  defaultLayout,
  newId,
  type StatsBlock,
  type StatsBlockCategory,
  type StatsBlockKind,
  type StatsBlockSize,
  type StatsLayout,
  type StatsTemplate,
} from "@/lib/stats-layout";
import { DAY, buildScope, mineOf, periodRange, sessionsOf, type Period } from "@/lib/stats-scope";
import { StatsBlockView, blockTitle, type BlockCtx } from "@/components/stats/StatsBlocks";
import { rememberCrewAction } from "@/app/(app)/crews/active-crew-actions";
import { saveStatsLayoutAction } from "@/app/(app)/stats/actions";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

const dayInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted uppercase";
const pill = "h-9 px-3 rounded-[10px] bg-surface-deep border border-line text-cream font-body font-semibold text-[13px]";

type Drag = { id: string; ox: number; oy: number; dx: number; dy: number };

export function StatsPage({
  data,
  currentUserId,
  backHref,
  initialCrewId,
  initialLayout,
}: Readonly<{ data: StatsExplorerData; currentUserId: string; backHref: string; initialCrewId?: string; initialLayout: StatsLayout | null }>) {
  const { t, locale } = useT();
  const sb = t.sb;
  const [now] = useState(() => Date.now());

  // ---- Filters --------------------------------------------------------
  const defaultCrew = useMemo(() => {
    if (initialCrewId && data.crews.some((c) => c.id === initialCrewId)) return initialCrewId;
    const count = new Map<string, number>();
    for (const g of data.games) if (g.crewId && g.teams.some((x) => x.userIds.includes(currentUserId))) count.set(g.crewId, (count.get(g.crewId) ?? 0) + 1);
    return [...data.crews].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0]?.id ?? "";
  }, [data, currentUserId, initialCrewId]);
  const [crewId, setCrewId] = useState(defaultCrew);
  const [playerId, setPlayerId] = useState(currentUserId);
  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState(() => dayInput(now - 30 * DAY));
  const [to, setTo] = useState(() => dayInput(now));

  const nameOf = useMemo(() => new Map(data.people.map((p) => [p.id, firstName(p.name)])), [data.people]);
  const crew = data.crews.find((c) => c.id === crewId);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
  const dateTimeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [locale]);

  const scope = useMemo(() => {
    const crewGames = data.games.filter((g) => g.crewId === crewId);
    const last = sessionsOf(mineOf(crewGames, playerId).map((x) => x.g))[0];
    const range = periodRange(period, now, { lastSessionStart: last ? new Date(last[0].playedAt).getTime() : undefined, from, to });
    return buildScope(data, crewId, playerId, range);
  }, [data, crewId, playerId, period, now, from, to]);
  const people = useMemo(
    () => [...new Set([currentUserId, ...scope.people])].sort((a, b) => (a === currentUserId ? -1 : b === currentUserId ? 1 : (nameOf.get(a) ?? "").localeCompare(nameOf.get(b) ?? ""))),
    [scope.people, currentUserId, nameOf],
  );

  const ctx: BlockCtx = {
    sb,
    name: (id) => nameOf.get(id) ?? t.more.player,
    playerId,
    isMe: playerId === currentUserId,
    crewName: crew?.name ?? "",
    date: (iso) => dateFmt.format(new Date(iso)),
    dateTime: (iso) => dateTimeFmt.format(new Date(iso)),
  };

  // ---- Layout ---------------------------------------------------------
  const [layout, setLayout] = useState<StatsLayout>(() => initialLayout ?? defaultLayout({ overview: sb.defOverview, mama: sb.defMama, duos: sb.defDuos }));
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [library, setLibrary] = useState(false);
  const [creating, setCreating] = useState(false);
  const pager = useRef<HTMLDivElement>(null);
  const screen = layout.screens[Math.min(index, layout.screens.length - 1)];

  const persist = (next: StatsLayout) => {
    setLayout(next);
    saveStatsLayoutAction(next).catch(() => {});
  };
  const updateScreen = (fn: (blocks: StatsBlock[]) => StatsBlock[], name?: string) =>
    setLayout((l) => ({ ...l, screens: l.screens.map((s) => (s.id === screen.id ? { ...s, blocks: fn(s.blocks), name: name ?? s.name } : s)) }));

  function goTo(i: number) {
    setIndex(i);
    const el = pager.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }
  // Keep the pager on the current screen when it (re)appears after editing or
  // when screens are added/removed — not on every index change, which would
  // fight the user's own swipe.
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    if (editing) return;
    const el = pager.current;
    if (el) el.scrollTo({ left: indexRef.current * el.clientWidth });
  }, [editing, layout.screens.length]);

  function onScroll() {
    const el = pager.current;
    if (!el || editing) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== index) setIndex(i);
  }

  function removeScreen(id: string) {
    const s = layout.screens.find((x) => x.id === id);
    if (!s || layout.screens.length <= 1) return;
    if (!window.confirm(format(sb.removeScreenConfirm, { name: s.name || sb.newScreen }))) return;
    const next = { ...layout, screens: layout.screens.filter((x) => x.id !== id) };
    setIndex((i) => Math.min(i, next.screens.length - 1));
    persist(next);
  }

  function createScreen(name: string, tpl: StatsTemplate) {
    if (layout.screens.length >= MAX_SCREENS) return;
    const next = { ...layout, screens: [...layout.screens, { id: newId("s"), name: name.trim().slice(0, MAX_SCREEN_NAME) || sb.newScreen, blocks: blocksFrom(tpl) }] };
    persist(next);
    setCreating(false);
    setEditing(false);
    setIndex(next.screens.length - 1);
  }

  function addBlock(kind: StatsBlockKind) {
    if (screen.blocks.length >= MAX_BLOCKS) return;
    updateScreen((b) => [...b, { id: newId("b"), kind, size: BLOCKS[kind].sizes[0] }]);
    setLibrary(false);
  }

  function done() {
    setEditing(false);
    persist(layout);
  }

  // ---- Drag to reorder (pointer events, so it works with touch) -----------
  const grid = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<Drag | null>(null);

  function startDrag(id: string, e: ReactPointerEvent) {
    const el = items.current.get(id);
    if (!el) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    setDrag({ id, ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0 });
  }
  function moveDrag(e: ReactPointerEvent) {
    if (!drag) return;
    const el = items.current.get(drag.id);
    const g = grid.current;
    if (!el || !g) return;
    const gr = g.getBoundingClientRect();
    // Which block is under the finger? Move the dragged one to its slot.
    const over = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((n) => (n as HTMLElement).closest?.("[data-block-id]") as HTMLElement | null)
      .find((n) => n && n.dataset.blockId !== drag.id);
    if (over?.dataset.blockId) {
      const target = over.dataset.blockId;
      updateScreen((blocks) => {
        const from = blocks.findIndex((b) => b.id === drag.id);
        const to = blocks.findIndex((b) => b.id === target);
        if (from < 0 || to < 0 || from === to) return blocks;
        const next = [...blocks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 110) window.scrollBy(0, 14);
    setDrag({ ...drag, dx: e.clientX - gr.left - drag.ox - el.offsetLeft, dy: e.clientY - gr.top - drag.oy - el.offsetTop });
  }
  const endDrag = () => setDrag(null);

  const periods: [Period, string][] = [
    ["session", sb.pSession],
    ["7d", sb.p7],
    ["30d", sb.p30],
    ["season", sb.pSeason],
    ["ever", sb.pEver],
    ["custom", sb.pCustom],
  ];

  const filters = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <label className="relative">
          <span className="sr-only">{sb.player}</span>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={cn(pill, "pr-7 appearance-none")}>
            {people.map((id) => (
              <option key={id} value={id}>
                {id === currentUserId ? sb.me : ctx.name(id)}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
        <label className="relative">
          <span className="sr-only">{sb.period}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={cn(pill, "pr-7 appearance-none")}>
            {periods.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-2 font-body text-sm text-muted">
          <input type="date" aria-label={sb.from} value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="flex-1 h-10 px-3 rounded-[10px] bg-surface-deep border border-line text-cream" />
          <span aria-hidden="true">→</span>
          <input type="date" aria-label={sb.to} value={to} min={from} onChange={(e) => setTo(e.target.value)} className="flex-1 h-10 px-3 rounded-[10px] bg-surface-deep border border-line text-cream" />
        </div>
      )}
    </div>
  );

  // ---- Edit mode ------------------------------------------------------
  if (editing) {
    return (
      <div className="relative min-h-screen bg-surface w-full max-w-xl mx-auto">
        <div className="flex flex-col gap-3.5 px-5 pt-4.5 pb-32">
          <header className="flex items-center gap-2.5 h-11">
            <label className="flex-1 min-w-0 flex flex-col">
              <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-gold">{sb.editing}</span>
              <span className="sr-only">{sb.screenName}</span>
              <input
                type="text"
                value={screen.name}
                maxLength={MAX_SCREEN_NAME}
                onChange={(e) => updateScreen((b) => b, e.target.value)}
                className="w-full max-w-60 bg-transparent border-0 border-b-2 border-dashed border-gold/50 pb-0.5 font-display font-extrabold text-[28px] leading-none uppercase text-cream outline-none"
              />
            </label>
            <button type="button" onClick={done} className="h-11 px-4.5 rounded-pill bg-amber text-ink font-heading font-extrabold text-[17px] tracking-[0.08em]">
              {sb.done}
            </button>
          </header>

          <nav aria-label={sb.screens} className="flex gap-1.5 overflow-x-auto -mx-5 px-5">
            {layout.screens.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "shrink-0 h-9 pl-3 pr-1.5 rounded-[10px] flex items-center gap-1 font-heading font-extrabold text-[15px] tracking-[0.06em] uppercase",
                  i === index ? "bg-amber text-ink" : "bg-surface-deep border border-line text-muted",
                )}
              >
                <button type="button" onClick={() => setIndex(i)} className="uppercase">
                  {s.name || sb.newScreen}
                </button>
                {layout.screens.length > 1 && (
                  <button type="button" onClick={() => removeScreen(s.id)} aria-label={format(sb.removeScreen, { name: s.name })} className="w-7 h-7 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
            {layout.screens.length < MAX_SCREENS && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="shrink-0 h-9 px-3 rounded-[10px] border border-dashed border-gold/50 text-gold flex items-center gap-1.5 font-heading font-extrabold text-[15px] tracking-[0.06em]"
              >
                <PlusIcon size={14} />
                {sb.addScreen}
              </button>
            )}
          </nav>

          <p className="flex items-center gap-2 font-body text-[13px] text-muted">
            <GripIcon className="text-muted shrink-0" />
            {sb.dragHint}
          </p>

          <div ref={grid} className="relative grid grid-cols-2 gap-2.5">
            {screen.blocks.map((b) => {
              const dragging = drag?.id === b.id;
              const title = blockTitle(sb, b.kind);
              return (
                <div
                  key={b.id}
                  data-block-id={b.id}
                  ref={(el) => {
                    if (el) items.current.set(b.id, el);
                    else items.current.delete(b.id);
                  }}
                  className={cn("relative min-w-0", b.size === "S" ? "col-span-1" : "col-span-2", dragging && "z-20")}
                  style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(-2deg) scale(1.02)` } : undefined}
                >
                  <div className={cn("rounded-[18px] h-full", dragging ? "outline-2 outline-gold shadow-[0_18px_40px_rgba(0,0,0,0.6)]" : "outline-1 outline-dashed outline-cream/22")}>
                    <div className="pointer-events-none select-none opacity-45 h-full [&>section]:h-full [&>section]:pt-13 [&>section]:pb-12">
                      <StatsBlockView block={b} s={scope} ctx={ctx} />
                    </div>
                  </div>
                  <div className="absolute inset-x-2.5 top-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={title}
                      onPointerDown={(e) => startDrag(b.id, e)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center touch-none cursor-grab", dragging ? "bg-amber text-ink" : "bg-surface-raised text-muted")}
                    >
                      <GripIcon />
                    </button>
                    <span className="flex-1 min-w-0 truncate font-heading font-bold text-[12px] tracking-[0.14em] text-soft uppercase">{title}</span>
                    <button
                      type="button"
                      onClick={() => updateScreen((list) => list.filter((x) => x.id !== b.id))}
                      aria-label={format(sb.removeBlock, { name: title })}
                      className="w-8 h-8 rounded-pill bg-red text-ink flex items-center justify-center"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" aria-hidden="true">
                        <path d="M6 12h12" />
                      </svg>
                    </button>
                  </div>
                  {BLOCKS[b.kind].sizes.length > 1 && (
                    <div role="group" aria-label={sb.size} className="absolute left-2.5 bottom-2.5 flex gap-0.5 p-0.75 rounded-[9px] bg-surface border border-line">
                      {(["S", "M", "L"] as StatsBlockSize[])
                        .filter((k) => BLOCKS[b.kind].sizes.includes(k))
                        .map((k) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={b.size === k}
                            onClick={() => updateScreen((list) => list.map((x) => (x.id === b.id ? { ...x, size: k } : x)))}
                            className={cn("w-8 h-7 rounded-[6px] font-heading font-extrabold text-[13px]", b.size === k ? "bg-amber text-ink" : "text-muted")}
                          >
                            {k}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            {screen.blocks.length === 0 && (
              <p className="col-span-2 py-10 text-center font-body text-sm text-muted">{sb.emptyScreen}</p>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 z-30">
          <div className="max-w-xl mx-auto px-5 pt-3.5 pb-[calc(26px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_top,var(--color-surface)_70%,transparent)]">
            <button
              type="button"
              onClick={() => setLibrary(true)}
              disabled={screen.blocks.length >= MAX_BLOCKS}
              className="w-full h-14 rounded-[16px] bg-surface-deep border-2 border-dashed border-gold/60 text-gold flex items-center justify-center gap-2.5 font-heading font-extrabold text-[19px] tracking-[0.06em] disabled:opacity-40"
            >
              <PlusIcon size={18} />
              {sb.addBlock}
            </button>
          </div>
        </div>

        {library && <BlockLibrary sb={sb} onScreen={new Set(screen.blocks.map((b) => b.kind))} onAdd={addBlock} onClose={() => setLibrary(false)} />}
        {creating && <NewScreenSheet sb={sb} n={layout.screens.length + 1} onCreate={createScreen} onClose={() => setCreating(false)} />}
      </div>
    );
  }

  // ---- View mode ------------------------------------------------------
  return (
    <div className="min-h-screen bg-surface w-full max-w-xl mx-auto flex flex-col gap-3.5 pt-4.5 pb-7">
      <div className="flex flex-col gap-3.5 px-5">
        <header className="flex items-center gap-2.5 h-11">
          <Link
            href={backHref}
            aria-label={t.common.back}
            className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="flex-1 font-display font-extrabold text-[30px] tracking-[0.04em]">{sb.title}</h1>
          {data.crews.length > 1 ? (
            <label className="relative">
              <span className="sr-only">{sb.crew}</span>
              <select
                value={crewId}
                onChange={(e) => {
                  setCrewId(e.target.value);
                  rememberCrewAction(e.target.value).catch(() => {});
                }}
                className="h-9 max-w-36 pl-3 pr-7 rounded-pill bg-surface-panel border border-line-strong text-cream font-body font-semibold text-[13px] appearance-none truncate"
              >
                {data.crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Chevron />
            </label>
          ) : (
            crew && <span className="font-body font-semibold text-[13px] text-muted truncate max-w-32">{crew.name}</span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={sb.edit}
            className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16z" />
              <path d="M13 7l4 4" />
            </svg>
          </button>
        </header>

        <nav aria-label={sb.screens} className="flex gap-1.5 overflow-x-auto -mx-5 px-5">
          {layout.screens.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? "page" : undefined}
              className={cn(
                "shrink-0 h-9 px-3.5 rounded-[10px] font-heading font-extrabold text-[15px] tracking-[0.06em] uppercase",
                i === index ? "bg-amber text-ink" : "bg-surface-deep border border-line text-muted",
              )}
            >
              {s.name || sb.newScreen}
            </button>
          ))}
          {layout.screens.length < MAX_SCREENS && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setCreating(true);
              }}
              aria-label={sb.newScreen}
              className="shrink-0 w-9 h-9 rounded-[10px] border border-dashed border-cream/25 text-muted flex items-center justify-center"
            >
              <PlusIcon size={16} />
            </button>
          )}
        </nav>

        {filters}
      </div>

      <div ref={pager} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {layout.screens.map((s) => (
          <section key={s.id} aria-label={s.name} className="w-full shrink-0 snap-start px-5">
            <div className="grid grid-cols-2 gap-2.5">
              {s.blocks.map((b) => (
                <StatsBlockView key={b.id} block={b} s={scope} ctx={ctx} />
              ))}
              {s.blocks.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setLibrary(true);
                  }}
                  className="col-span-2 h-40 rounded-[18px] border-2 border-dashed border-gold/50 text-gold flex flex-col items-center justify-center gap-2 font-heading font-extrabold text-lg tracking-[0.06em]"
                >
                  <PlusIcon size={22} />
                  {sb.emptyCta}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {layout.screens.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-label={format(sb.screenOf, { n: index + 1, t: layout.screens.length })}>
          {layout.screens.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={s.name}
              className={cn("h-1.5 rounded-[3px] transition-all", i === index ? "w-5 bg-gold" : "w-1.5 bg-[#3a4245]")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-cream">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusIcon({ size }: Readonly<{ size: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function GripIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="9" cy="6" r="1.8" />
      <circle cx="15" cy="6" r="1.8" />
      <circle cx="9" cy="12" r="1.8" />
      <circle cx="15" cy="12" r="1.8" />
      <circle cx="9" cy="18" r="1.8" />
      <circle cx="15" cy="18" r="1.8" />
    </svg>
  );
}

const CAT_GLYPH: Record<StatsBlockCategory, string> = {
  elo: "M4 28 L16 22 L26 25 L38 14 L48 16 L60 6",
  mama: "M32 6 A12 12 0 1 1 20.5 26",
  duo: "M20 30 a8 8 0 0 1 16 0 M28 14 a5 5 0 1 0 0.1 0 M36 30 a8 8 0 0 1 16 0 M44 14 a5 5 0 1 0 0.1 0",
  crew: "M14 10 H50 M14 18 H44 M14 26 H38",
  nights: "M10 30 V18 M22 30 V10 M34 30 V20 M46 30 V6 M58 30 V14",
};
const CAT_TONE: Record<StatsBlockCategory, string> = {
  elo: "text-gold",
  mama: "text-red",
  duo: "text-mint",
  crew: "text-soft",
  nights: "text-gold",
};

function BlockLibrary({
  sb,
  onScreen,
  onAdd,
  onClose,
}: Readonly<{ sb: ReturnType<typeof useT>["t"]["sb"]; onScreen: Set<StatsBlockKind>; onAdd: (k: StatsBlockKind) => void; onClose: () => void }>) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StatsBlockCategory | "all">("all");
  const cats: [StatsBlockCategory | "all", string][] = [
    ["all", sb.catAll],
    ["elo", sb.catElo],
    ["mama", sb.catMama],
    ["duo", sb.catDuo],
    ["crew", sb.catCrew],
    ["nights", sb.catNights],
  ];
  const list = BLOCK_KINDS.filter((k) => cat === "all" || BLOCKS[k].cat === cat).filter((k) => {
    const needle = q.trim().toLowerCase();
    return !needle || `${sb.b[k]} ${sb.b[`${k}D` as keyof typeof sb.b]}`.toLowerCase().includes(needle);
  });
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label={sb.close} onClick={onClose} className="absolute inset-0 bg-black/55" />
      <section role="dialog" aria-modal="true" aria-label={sb.library} className="absolute inset-x-0 bottom-0 top-20 max-w-xl mx-auto rounded-t-[26px] bg-surface-deep border-t border-line-strong flex flex-col gap-3.5 px-5 pt-2.5 pb-6">
        <span aria-hidden="true" className="self-center w-11 h-1.25 rounded-[3px] bg-[#3a4245]" />
        <div className="flex items-center justify-between">
          <h2 className="font-display font-extrabold text-[28px] tracking-[0.02em]">{sb.library}</h2>
          <button type="button" onClick={onClose} aria-label={sb.close} className="w-10 h-10 rounded-pill bg-surface-raised text-cream flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <label className="flex items-center gap-2.5 h-11.5 px-3.5 rounded-[12px] bg-surface border border-line-strong">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <span className="sr-only">{sb.search}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={sb.search} className="flex-1 bg-transparent border-0 outline-none font-body text-[15px] text-cream placeholder:text-muted" />
        </label>
        <div role="group" aria-label={sb.catAll} className="flex gap-1.5 overflow-x-auto -mx-5 px-5">
          {cats.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={cat === id}
              onClick={() => setCat(id)}
              className={cn("shrink-0 h-8.5 px-3 rounded-[10px] font-heading font-extrabold text-sm tracking-[0.06em]", cat === id ? "bg-amber text-ink" : "bg-surface text-muted border border-line")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2.5 content-start pb-4">
          {list.map((k) => {
            const def = BLOCKS[k];
            const added = onScreen.has(k);
            return (
              <article key={k} className="flex flex-col gap-2 p-3 rounded-[16px] bg-surface border border-line">
                <div aria-hidden="true" className="relative h-16 rounded-[10px] bg-surface-raised flex items-center justify-center">
                  <svg width="64" height="36" viewBox="0 0 64 36" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={CAT_TONE[def.cat]}>
                    <path d={CAT_GLYPH[def.cat]} />
                  </svg>
                  {def.pro && <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-[5px] bg-amber text-ink font-heading font-extrabold text-[10px] tracking-[0.1em]">{sb.pro}</span>}
                </div>
                <span className="font-display font-extrabold text-[17px] leading-[1.05] uppercase">{sb.b[k]}</span>
                <span className="font-body text-xs leading-snug text-muted min-h-8">{sb.b[`${k}D` as keyof typeof sb.b]}</span>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-heading font-bold text-[12px] tracking-[0.08em] text-muted">{[...def.sizes].sort().join(" · ")}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(k)}
                    aria-label={`${sb.add} ${sb.b[k]}`}
                    className={cn("h-8 px-2.5 rounded-[9px] font-heading font-extrabold text-[13px] tracking-[0.06em]", added ? "text-muted border border-line-strong" : "bg-amber text-ink")}
                  >
                    {added ? sb.onScreen : sb.add}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NewScreenSheet({
  sb,
  n,
  onCreate,
  onClose,
}: Readonly<{ sb: ReturnType<typeof useT>["t"]["sb"]; n: number; onCreate: (name: string, tpl: StatsTemplate) => void; onClose: () => void }>) {
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState<StatsTemplate>("empty");
  const options: [StatsTemplate, string, string][] = [
    ["empty", sb.tEmpty, sb.tEmptyD],
    ["overview", sb.tOverview, sb.tOverviewD],
    ["mama", sb.tMama, sb.tMamaD],
    ["duos", sb.tDuos, sb.tDuosD],
    ["rivals", sb.tRivals, sb.tRivalsD],
    ["nights", sb.tNights, sb.tNightsD],
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label={sb.newTitle} className="fixed inset-0 z-50 bg-surface overflow-y-auto">
      <div className="max-w-xl mx-auto flex flex-col gap-4.5 px-5 pt-4.5 pb-32">
        <header className="flex items-center gap-3 h-11">
          <button type="button" onClick={onClose} aria-label={sb.close} className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className="flex flex-col">
            <span className={kicker}>{format(sb.newKicker, { n })}</span>
            <h2 className="font-display font-extrabold text-[28px] leading-none">{sb.newTitle}</h2>
          </span>
        </header>
        <label className="flex flex-col gap-1.5">
          <span className={kicker}>{sb.name}</span>
          <input
            type="text"
            value={name}
            maxLength={MAX_SCREEN_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder={options.find((o) => o[0] === tpl)?.[1]}
            className="h-13 rounded-[14px] bg-surface-deep border border-gold/50 px-4 font-display font-extrabold text-2xl uppercase text-cream placeholder:text-muted outline-none"
          />
        </label>
        <section aria-label={sb.startFrom} className="flex flex-col gap-2.5">
          <span className={kicker}>{sb.startFrom}</span>
          {options.map(([id, label, desc]) => {
            const on = tpl === id;
            const cells = TEMPLATES[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setTpl(id)}
                className={cn("flex items-center gap-3.5 w-full p-3.5 rounded-[16px] border-2 text-left text-cream", on ? "bg-amber/10 border-gold" : "bg-surface-deep border-line")}
              >
                <span aria-hidden="true" className="w-17 shrink-0 grid grid-cols-2 gap-1">
                  {cells.length === 0 ? (
                    <span className="col-span-2 h-12 rounded-[6px] border-[1.5px] border-dashed border-[#3a4245]" />
                  ) : (
                    cells.slice(0, 5).map(([, size], i) => (
                      <span key={i} className={cn("rounded-[4px]", size === "S" ? "col-span-1 h-5" : size === "M" ? "col-span-2 h-4.5" : "col-span-2 h-6.5", on ? "bg-gold" : "bg-chip")} />
                    ))
                  )}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.75">
                  <span className="font-display font-extrabold text-xl leading-none uppercase">{label}</span>
                  <span className="font-body text-[13px] leading-snug text-muted">{desc}</span>
                </span>
                <span className={cn("w-6 h-6 shrink-0 rounded-pill flex items-center justify-center", on ? "bg-amber text-ink" : "border-2 border-[#3a4245] text-transparent")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </span>
              </button>
            );
          })}
        </section>
        <p className="font-body text-[13px] leading-[1.45] text-muted">{sb.newNote}</p>
      </div>
      <div className="fixed bottom-0 inset-x-0">
        <div className="max-w-xl mx-auto px-5 pt-3.5 pb-[calc(26px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_top,var(--color-surface)_70%,transparent)]">
          <button
            type="button"
            onClick={() => onCreate(name || (options.find((o) => o[0] === tpl)?.[1] ?? ""), tpl)}
            className="w-full h-14.5 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.06em]"
          >
            {sb.create}
          </button>
        </div>
      </div>
    </div>
  );
}
