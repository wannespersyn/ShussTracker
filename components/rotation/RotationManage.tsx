/**
 * RotationManage
 *
 * Change a running Americano / Mexicano: mats, rounds, who keeps playing,
 * who joins from the crew, and the standings order. Shows what gets
 * re-planned and asks to confirm before saving.
 *
 * Data: calls updateRotationAction (server action), which redirects.
 */
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateRotationAction } from "@/app/(app)/americano/actions";
import type { RotationMode, TiebreakKey } from "@/lib/rotation";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

export function RotationManage({
  rotationId,
  mode,
  mats: initialMats,
  rounds: initialRounds,
  currentRound,
  players,
  crew,
  tiebreaks: initialTiebreaks,
}: Readonly<{
  rotationId: string;
  mode: RotationMode;
  mats: number;
  rounds: number;
  currentRound: number;
  players: { id: string; name: string; active: boolean }[];
  crew: { id: string; name: string }[];
  tiebreaks: TiebreakKey[];
}>) {
  const { t } = useT();
  const R = t.rot;
  const [pending, start] = useTransition();
  const [mats, setMats] = useState(initialMats);
  const [rounds, setRounds] = useState(initialRounds);
  const [active, setActive] = useState(() => new Set(players.filter((p) => p.active).map((p) => p.id)));
  const [add, setAdd] = useState<string[]>([]);
  const [order, setOrder] = useState<TiebreakKey[]>(initialTiebreaks);

  const others = crew.filter((c) => !players.some((p) => p.id === c.id));
  const n = active.size + add.length;
  const lineupChanged = add.length > 0 || players.some((p) => p.active !== active.has(p.id)) || rounds !== initialRounds;
  const impact = !lineupChanged
    ? R.impactNone
    : mode === "americano"
      ? format(R.impactA, { from: currentRound + 1, to: Math.max(rounds, currentRound + 1), n })
      : format(R.impactM, { n });
  const label: Record<TiebreakKey, string> = { pct: R.tbPct, wins: R.tbWins, mama: R.tbMama, elo: R.tbElo };

  const toggle = (id: string) =>
    setActive((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save() {
    if (n < 4) return;
    if (lineupChanged && !window.confirm(impact)) return;
    start(() => updateRotationAction(rotationId, { mats, rounds, activeIds: [...active], addIds: add, tiebreaks: order }));
  }

  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted";

  return (
    <div className="relative min-h-screen bg-surface w-full max-w-xl mx-auto">
      <div className="flex flex-col gap-5 px-5 pt-4.5 pb-36">
        <header className="flex items-center gap-3 h-11">
          <Link
            href={`/americano/${rotationId}`}
            aria-label={t.common.back}
            className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="font-display font-extrabold text-[28px] leading-none">{R.manageTitle}</h1>
        </header>

        <div className="grid grid-cols-2 gap-2.5">
          <Stepper label={R.manageMats} value={mats} min={1} max={8} onChange={setMats} />
          <Stepper label={R.manageRounds} value={rounds} min={currentRound} max={30} onChange={setRounds} />
        </div>

        <section aria-label={R.managePlayers} className="flex flex-col gap-2">
          <span className={kicker}>{R.managePlayers}</span>
          {players.map((p) => {
            const on = active.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className="flex items-center gap-3 min-h-13 px-3.5 rounded-[14px] bg-surface-deep border border-line text-left text-cream"
              >
                <span className={cn("w-9 h-9 rounded-pill flex items-center justify-center font-display font-extrabold text-[13px] uppercase", on ? "bg-amber text-ink" : "bg-chip text-muted")}>
                  {p.name.slice(0, 2)}
                </span>
                <span className={cn("flex-1 font-body font-semibold text-[15px]", !on && "text-muted line-through")}>{firstName(p.name)}</span>
                <span className={cn("font-body text-xs font-semibold", on ? "text-mint" : "text-red-pale")}>{on ? R.playing : R.stopped}</span>
                <span className={cn("w-12 h-7 rounded-pill p-0.75 flex", on ? "bg-amber justify-end" : "bg-chip justify-start")}>
                  <span className={cn("w-5.5 h-5.5 rounded-pill", on ? "bg-ink" : "bg-muted")} />
                </span>
              </button>
            );
          })}
        </section>

        {others.length > 0 && (
          <section aria-label={R.addPlayers} className="flex flex-col gap-2">
            <span className={kicker}>{R.addPlayers}</span>
            <div className="flex flex-wrap gap-2">
              {others.map((c) => {
                const on = add.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAdd((a) => (a.includes(c.id) ? a.filter((x) => x !== c.id) : [...a, c.id]))}
                    className={cn("h-11 px-3.5 rounded-[12px] border font-body font-semibold text-sm", on ? "bg-amber text-ink border-amber" : "bg-surface-deep text-soft border-line")}
                  >
                    {on ? `+ ${firstName(c.name)} · ${R.joins}` : `+ ${firstName(c.name)}`}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-label={R.tiebreaks} className="flex flex-col gap-2">
          <span className={kicker}>{R.tiebreaks}</span>
          <ol className="flex flex-col gap-1.5">
            {order.map((k, i) => (
              <li key={k} className="flex items-center gap-3 h-12 px-3.5 rounded-[14px] bg-surface-deep border border-line">
                <span className="w-5 font-heading font-extrabold text-base text-gold">{i + 1}</span>
                <span className="flex-1 font-body font-semibold text-[15px]">{label[k]}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={format(R.up, { name: label[k] })} className="w-10 h-9 rounded-[10px] bg-surface-raised text-cream disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={format(R.down, { name: label[k] })} className="w-10 h-9 rounded-[10px] bg-surface-raised text-cream disabled:opacity-30">
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </section>

        <p className={cn("font-body text-[13px] leading-[1.45]", n < 4 ? "text-red-pale" : "text-muted")}>{n < 4 ? R.minActive : impact}</p>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-xl mx-auto px-5 pt-3.5 pb-[calc(26px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_top,var(--color-surface)_70%,transparent)]">
          <button
            type="button"
            onClick={save}
            disabled={pending || n < 4}
            className="w-full h-14.5 rounded-[16px] bg-amber text-ink font-heading font-extrabold text-xl tracking-[0.06em] disabled:bg-surface-raised disabled:text-muted"
          >
            {pending ? R.saving : R.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: Readonly<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }>) {
  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-[16px] bg-surface-deep border border-line">
      <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-muted">{label}</span>
      <div className="flex items-center justify-between">
        <button type="button" aria-label={`${label} −`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="w-11 h-11 rounded-[12px] border border-line-strong bg-surface-raised text-cream text-[22px] font-bold disabled:opacity-40">
          −
        </button>
        <span className="font-display font-extrabold text-5xl leading-none tabular-nums">{value}</span>
        <button type="button" aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="w-11 h-11 rounded-[12px] border border-gold/45 bg-amber/13 text-gold text-[22px] font-bold disabled:opacity-40">
          +
        </button>
      </div>
    </div>
  );
}
