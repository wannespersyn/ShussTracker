"use client";

import { useMemo, useState } from "react";
import { AvatarChip, StatCounter } from "@/components/ui";
import { FilterIcon } from "@/components/ui/icons";
import type { CapRingColor } from "@/lib/theme/tokens";
import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { StatsExplorerData, StatsPerson } from "@/lib/db/stats";
import {
  DIMS,
  activeDims,
  chipLabel,
  computeRankedList,
  defaultFilters,
  filterGames,
  focalIdsFor,
  heroCopy,
  nameFor,
  sheetOptions,
  sumShots,
  totalOf,
  visibleFields,
  winLoss,
  type DimKey,
  type Filters,
  type RankedRow,
} from "./stats-logic";

const RING_CYCLE: CapRingColor[] = ["gold", "red", "mint", "cream"];

function ringFor(people: StatsPerson[], userId: string): CapRingColor {
  const idx = Math.max(0, people.findIndex((p) => p.id === userId));
  return RING_CYCLE[idx % RING_CYCLE.length];
}

export function StatsExplorer({ data, currentUserId }: Readonly<{ data: StatsExplorerData; currentUserId: string }>) {
  const [f, setF] = useState<Filters>(() => defaultFilters(currentUserId));
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedDim, setExpandedDim] = useState<DimKey | null>(null);

  const active = useMemo(() => activeDims(f, currentUserId), [f, currentUserId]);
  const sel = useMemo(() => filterGames(data.games, f), [data.games, f]);
  const focal = useMemo(() => focalIdsFor(f), [f]);
  const hasData = sel.length > 0;

  const { w, l } = useMemo(() => winLoss(sel, focal), [sel, focal]);
  const pct = w + l > 0 ? Math.round((w * 100) / (w + l)) : 0;
  const heroIsPct = focal !== null;

  const counts = useMemo(() => sumShots(sel, focal), [sel, focal]);
  const total = totalOf(counts);
  const hits = total - counts.miss;
  const acc = total > 0 ? Math.round((hits * 100) / total) : 0;

  const ranked = useMemo(
    () => computeRankedList(f, sel, data.games, data.people, data.crews, data.events, currentUserId),
    [f, sel, data.games, data.people, data.crews, data.events, currentUserId],
  );

  function setDim(dim: DimKey, val: string | null) {
    setF((prev) => ({ ...prev, [dim]: val }) as Filters);
    setExpandedDim(null);
  }

  function clearDim(dim: DimKey) {
    setF((prev) => {
      if (dim === "person") return { ...prev, person: currentUserId };
      if (dim === "period") return { ...prev, period: "all" };
      return { ...prev, [dim]: null };
    });
  }

  function clearAll() {
    setF(defaultFilters(currentUserId));
    setExpandedDim(null);
  }

  function loosen() {
    setF((prev) => ({ ...prev, mat: null, period: "all" }));
  }

  function openPanel(dim: DimKey | null) {
    setPanelOpen(true);
    setExpandedDim(dim);
  }

  function closePanel() {
    setPanelOpen(false);
    setExpandedDim(null);
  }

  const fields = useMemo(() => visibleFields(data), [data]);
  const fieldMeta = f.field ? fields.find((x) => x.key === f.field)! : null;
  const isRisk = f.field === "risk";

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-[32px] leading-[1.02] text-cream">STATS</div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openPanel(null)}
            className={cn(
              "relative h-11 px-3.5 rounded-md flex items-center gap-2 font-heading font-bold text-[13px] tracking-[1.4px] uppercase border",
              active.length ? "bg-gold/14 border-gold/40 text-gold" : "bg-cream/5 border-cream/10 text-cream/62",
            )}
          >
            <FilterIcon className="w-4 h-4" />
            Filters
            {active.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-pill bg-gold text-ink font-mono font-semibold text-[10px] flex items-center justify-center">
                {active.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {hasData ? (
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Hero */}
          <div className="rounded-xl bg-gradient-hero border border-gold/28 px-5 pt-4.5 pb-4">
            <div className="flex justify-between items-baseline gap-2.5">
              <div className="font-heading font-bold text-[13px] tracking-[2px] uppercase text-cream/50">
                {heroIsPct ? "Win rate" : "Games logged"}
              </div>
              <div className="font-heading font-bold text-[12px] tracking-[1.2px] uppercase text-gold">
                {heroIsPct ? `${w} W · ${l} L` : `${sel.length} on record`}
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <StatCounter value={heroIsPct ? pct : sel.length} size={64} className="text-gold" />
              {heroIsPct && <span className="font-display text-[34px] text-gold/55">%</span>}
            </div>
            <div className="font-body text-[14.5px] text-cream/60 mt-1">
              {heroIsPct ? heroCopy(pct) : "Everybody in this slice, added up."}
            </div>
          </div>

          {/* Games + Accuracy */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-gradient-alt border border-cream/6 shadow-elevation-md p-3.75">
              <div className="font-heading font-bold text-[12px] tracking-[1.8px] uppercase text-cream/45">
                Games
              </div>
              <div className="font-mono font-semibold text-[26px] text-cream mt-1.5">{sel.length}</div>
              <div className="font-body text-[12.5px] text-cream/42 mt-0.5">
                {f.event ? "on this night" : f.duo ? "as a pairing" : "in this slice"}
              </div>
            </div>
            <div
              className={cn(
                "flex-1 rounded-lg border p-3.75",
                isRisk ? "bg-red/12 border-red/32" : "bg-gradient-hero border-cream/6",
              )}
            >
              <div
                className={cn(
                  "font-heading font-bold text-[12px] tracking-[1.8px] uppercase",
                  isRisk ? "text-red-pale" : "text-cream/45",
                )}
              >
                {fieldMeta ? `${fieldMeta.label} logged` : "Hit rate"}
              </div>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className={cn("font-mono font-semibold text-[26px]", isRisk ? "text-red-bright" : "text-cream")}>
                  {fieldMeta ? counts[fieldMeta.key] : acc}
                </span>
                {!fieldMeta && (
                  <span className={cn("font-mono font-semibold text-lg opacity-60", isRisk ? "text-red-bright" : "text-cream")}>
                    %
                  </span>
                )}
              </div>
              <div className={cn("font-body text-[12.5px] mt-0.5", isRisk ? "text-red-pale/80" : "text-cream/42")}>
                {fieldMeta
                  ? total
                    ? `${Math.round((counts[fieldMeta.key] * 100) / total)}% of all flicks`
                    : "no flicks yet"
                  : `${hits} of ${total} flicks`}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          {total > 0 && (
            <div className="rounded-lg bg-cream/4 shadow-elevation-md px-4 pt-4 pb-3.5">
              <div className="flex justify-between items-baseline mb-1">
                <div className="font-heading font-bold text-[12.5px] tracking-[1.8px] uppercase text-cream/50">
                  Where the caps land
                </div>
                <div className="font-heading font-bold text-[12px] tracking-[1.2px] uppercase text-cream/32">
                  {total} flicks · tap to filter
                </div>
              </div>
              {fields.map((fld) => {
                const n = counts[fld.key];
                const max = Math.max(1, counts.far, counts.mid, counts.near, counts.risk, counts.miss);
                const dim = f.field && f.field !== fld.key;
                return (
                  <button
                    key={fld.key}
                    type="button"
                    onClick={() => setDim("field", f.field === fld.key ? null : fld.key)}
                    className="w-full flex items-center gap-2.5 mt-2.75"
                    style={{ opacity: dim ? 0.34 : 1 }}
                  >
                    <div
                      className={cn(
                        "w-15.5 shrink-0 text-left font-heading font-bold text-[13px] tracking-[1.2px]",
                        f.field === fld.key ? "text-gold" : "text-cream/55",
                      )}
                    >
                      {fld.label}
                    </div>
                    <div className="flex-1 h-3.5 rounded-xs bg-cream/6 overflow-hidden">
                      <div
                        className="h-full rounded-xs"
                        style={{
                          width: `${Math.round((n * 100) / max)}%`,
                          background: fld.key === "risk" ? "var(--color-red)" : "var(--color-gold)",
                        }}
                      />
                    </div>
                    <div className="w-8.5 shrink-0 text-right font-mono font-semibold text-sm text-cream">{n}</div>
                    <div className="w-9.5 shrink-0 text-right font-mono font-medium text-[12.5px] text-cream/40">
                      {total ? Math.round((n * 100) / total) : 0}%
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Ranked list */}
          {ranked.rows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <div className="flex-1">
                  <div className="font-heading font-semibold text-heading text-cream">{ranked.title}</div>
                  <div className="font-body text-[12.5px] text-cream/42">{ranked.sub}</div>
                </div>
                <div className="font-mono font-medium text-[11.5px] tracking-widest uppercase text-cream/30">
                  {ranked.metric}
                </div>
              </div>
              {ranked.rows.map((row) => (
                <RankedRowView key={row.userIds.join("+")} row={row} people={data.people} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 rounded-xl bg-cream/4 border border-dashed border-cream/18 px-5.5 py-7.5 flex flex-col items-center gap-3.5 text-center">
          <div className="w-16 h-16 rounded-pill bg-cream/8 flex items-center justify-center font-display text-2xl text-cream/35">
            0
          </div>
          <div className="font-display text-2xl text-cream leading-[1.1]">NOTHING ON RECORD</div>
          <div className="font-body text-[14.5px] leading-snug text-cream/55 max-w-70">
            {f.duo
              ? `${f.duo.split("+").map((id) => nameFor(data.people, id)).join(" and ")} never shared that mat in this slice. Bold of you to ask.`
              : "No games match that combination yet. Somebody has to log one first."}
          </div>
          <div className="flex gap-2.5 mt-0.5">
            <button
              type="button"
              onClick={loosen}
              className="h-11.5 px-4.5 rounded-md bg-gold flex items-center font-display text-base tracking-[0.6px] text-ink"
            >
              DROP A FILTER
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="h-11.5 px-4.5 rounded-md border border-cream/22 flex items-center font-display text-base tracking-[0.6px] text-cream/70"
            >
              START OVER
            </button>
          </div>
        </div>
      )}

      {panelOpen && (
        <FilterPanel
          data={data}
          f={f}
          currentUserId={currentUserId}
          active={active}
          expandedDim={expandedDim}
          onExpand={(dim) => setExpandedDim((prev) => (prev === dim ? null : dim))}
          onPick={setDim}
          onClearDim={clearDim}
          onClearAll={clearAll}
          onClose={closePanel}
        />
      )}
    </div>
  );
}

function RankedRowView({ row, people }: Readonly<{ row: RankedRow; people: StatsPerson[] }>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.75 rounded-lg border px-3.25 py-2.75",
        row.hot ? "bg-gold/12 border-gold/42" : "bg-cream/5 border-cream/5",
      )}
    >
      <div className={cn("w-6 shrink-0 font-mono font-semibold text-base", row.hot ? "text-gold" : "text-cream/40")}>
        {row.rank}
      </div>
      {row.userIds.length > 1 ? (
        <div className="flex -space-x-3 shrink-0">
          {row.userIds.map((id) => (
            <AvatarChip key={id} initials={initialsFor(nameFor(people, id))} ring={ringFor(people, id)} size={34} />
          ))}
        </div>
      ) : (
        <AvatarChip initials={initialsFor(nameFor(people, row.userIds[0]))} ring={ringFor(people, row.userIds[0])} size={34} />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-body text-cream truncate">{row.name}</div>
        <div className="font-mono text-[11px] text-cream/45 truncate mt-0.5">{row.sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("font-mono font-semibold text-body", row.hot ? "text-gold" : "text-cream")}>{row.val}</div>
        <div className="font-mono font-medium text-[10.5px] tracking-widest text-cream/30 mt-0.5">{row.valSub}</div>
      </div>
    </div>
  );
}

const DIM_LABELS: Record<DimKey, string> = {
  person: "Person",
  event: "Event",
  duo: "Duo",
  crew: "Crew",
  mat: "Mat type",
  period: "Time range",
  field: "Field type",
};

/** A single slide-up panel listing every filter dimension at once, each
 * collapsible to its option list — replaces opening a separate modal per
 * dimension so the whole filter state stays visible while you edit it. */
function FilterPanel({
  data,
  f,
  currentUserId,
  active,
  expandedDim,
  onExpand,
  onPick,
  onClearDim,
  onClearAll,
  onClose,
}: Readonly<{
  data: StatsExplorerData;
  f: Filters;
  currentUserId: string;
  active: DimKey[];
  expandedDim: DimKey | null;
  onExpand: (dim: DimKey) => void;
  onPick: (dim: DimKey, val: string | null) => void;
  onClearDim: (dim: DimKey) => void;
  onClearAll: () => void;
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Close filters" onClick={onClose} className="absolute inset-0 bg-ink/75" />
      <div
        className="relative bg-surface-deep rounded-t-xl border-t border-cream/10 max-h-[85vh] flex flex-col animate-sheet-up"
      >
        <div className="flex items-center gap-2.5 px-5 pt-4.5 pb-3">
          <div className="flex-1">
            <div className="font-heading font-bold text-[12px] tracking-[1.8px] uppercase text-cream/42">
              {active.length > 0 ? `${active.length} active` : "Overview"}
            </div>
            <div className="font-display text-2xl leading-[1.05] text-cream">Filters</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 shrink-0 rounded-md bg-cream/8 flex items-center justify-center text-cream text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 flex flex-col gap-1.75 pb-2">
          {DIMS.map((dim) => {
            const isExpanded = expandedDim === dim;
            const isActive = active.includes(dim);
            const options = sheetOptions(dim, f, data, currentUserId);
            return (
              <div
                key={dim}
                className={cn("rounded-md border overflow-hidden", isActive ? "border-gold/35 bg-gold/6" : "border-cream/8 bg-cream/4")}
              >
                <div className="w-full flex items-center gap-2 h-13.5 pl-3.5 pr-2.5">
                  <button
                    type="button"
                    onClick={() => onExpand(dim)}
                    className="flex-1 min-w-0 h-full flex items-center gap-3"
                  >
                    <span className="flex-1 text-left font-heading font-bold text-[11.5px] tracking-[1.2px] uppercase text-cream/45">
                      {DIM_LABELS[dim]}
                    </span>
                    <span className={cn("font-body font-semibold text-[14.5px] truncate", isActive ? "text-gold" : "text-cream/70")}>
                      {chipLabel(dim, f, data, currentUserId)}
                    </span>
                    <span
                      className={cn(
                        "font-body font-semibold text-[11px] text-cream/35 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    >
                      ▾
                    </span>
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => onClearDim(dim)}
                      aria-label={`Clear ${dim} filter`}
                      className="w-6 h-6 shrink-0 rounded-pill bg-cream/10 flex items-center justify-center font-body font-semibold text-[13px] text-cream/60 leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 max-h-52 overflow-auto">
                    {options.map((o) => (
                      <button
                        key={String(o.val)}
                        type="button"
                        onClick={() => onPick(dim, o.val)}
                        className={cn(
                          "flex items-center gap-3 h-11.5 px-3 rounded-md border",
                          o.on ? "bg-gold/14 border-gold/40" : "bg-surface-deep border-cream/6",
                        )}
                      >
                        <span className={cn("flex-1 text-left font-body font-semibold text-[14.5px]", o.on ? "text-cream" : "text-cream/75")}>
                          {o.label}
                        </span>
                        {o.meta && <span className="font-body text-[12px] text-cream/38">{o.meta}</span>}
                        {o.on && <span className="font-display text-gold text-[14px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="flex-none flex gap-2.5 px-5 pt-3 border-t border-cream/8"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
        >
          <button
            type="button"
            onClick={onClearAll}
            disabled={active.length === 0}
            className="flex-1 h-12.5 rounded-md border border-cream/22 flex items-center justify-center font-display text-base tracking-[0.6px] text-cream/70 disabled:opacity-35"
          >
            CLEAR ALL
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12.5 rounded-md bg-gold flex items-center justify-center font-display text-base tracking-[0.6px] text-ink"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
