/**
 * RotationSetup
 *
 * New Americano / Mexicano: name, format, who plays, mats tonight and
 * number of rounds, with a live preview (rounds, games, sit-outs, duration).
 *
 * Data: calls createRotationAction (server action), which redirects.
 * Notes: copy lives in t.rot; scheduling math in lib/rotation.ts.
 */
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createRotationAction } from "@/app/(app)/americano/actions";
import { fullRotationRounds, gamesPerRound, type RotationMode } from "@/lib/rotation";
import { firstName } from "@/lib/insights";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";

/** Rough minutes per game, for the duration preview only. */
const MINUTES_PER_GAME = 10;

export function RotationSetup({
  groupId,
  roster,
}: Readonly<{ groupId: string; roster: { id: string; name: string; elo: number; games: number }[] }>) {
  const { t } = useT();
  const R = t.rot;
  const [pending, start] = useTransition();
  const [name, setName] = useState(R.defaultName);
  const [mode, setMode] = useState<RotationMode>("americano");
  const [picked, setPicked] = useState<string[]>([]);
  const [mats, setMats] = useState(1);
  const [rounds, setRounds] = useState<number | null>(null); // null = full rotation / default

  const n = picked.length;
  const defaultRounds = mode === "americano" ? fullRotationRounds(n) : Math.min(Math.max(n - 1, 3), 8);
  const r = rounds ?? defaultRounds;
  const perRound = gamesPerRound(n);
  const totalGames = perRound * r;
  const minutes = Math.ceil(perRound / Math.max(1, mats)) * r * MINUTES_PER_GAME;
  const ready = n >= 4 && r >= 1;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit() {
    if (!ready) return;
    start(() => createRotationAction({ groupId, name, mode, playerIds: picked, mats, rounds: r }));
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col gap-4 px-5 pt-4.5 pb-8 w-full max-w-xl mx-auto">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/crews/${groupId}`}
          aria-label={t.common.back}
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex flex-col">
          <span className="font-heading font-semibold text-[11px] tracking-[0.14em] text-muted">{R.kicker}</span>
          <h1 className="font-display font-extrabold text-[26px] leading-none tracking-[0.04em] uppercase">{R.title}</h1>
        </span>
      </header>

      <input
        type="text"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder={R.namePh}
        aria-label={R.namePh}
        className="h-12 rounded-[12px] bg-surface-deep border border-line px-4 font-body text-cream placeholder:text-muted outline-none focus:border-gold/50"
      />

      <section aria-label={R.mode} className="grid grid-cols-2 gap-2">
        {(
          [
            ["americano", R.americano, R.americanoSub],
            ["mexicano", R.mexicano, R.mexicanoSub],
          ] as const
        ).map(([id, label, sub]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => { setMode(id); setRounds(null); }}
            className={cn("flex flex-col gap-1 p-3.5 rounded-[14px] border-2 text-left", mode === id ? "border-gold bg-amber/10" : "border-line bg-surface-deep")}
          >
            <span className="font-display font-extrabold text-lg uppercase">{label}</span>
            <span className="font-body text-xs text-muted leading-snug">{sub}</span>
          </button>
        ))}
      </section>

      <section aria-label={format(R.players, { n })} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">{format(R.players, { n })}</span>
          <button
            type="button"
            onClick={() => setPicked(picked.length === roster.length ? [] : roster.map((p) => p.id))}
            className="font-heading font-bold text-[12px] tracking-[0.1em] uppercase text-gold"
          >
            {picked.length === roster.length ? R.none : R.all}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={cn("h-11 px-3.5 rounded-[12px] flex items-center gap-2 font-body font-semibold text-sm border", on ? "bg-amber text-ink border-amber" : "bg-surface-deep text-soft border-line")}
              >
                {firstName(p.name)}
                {p.games > 0 && <span className={cn("font-heading text-[12px]", on ? "text-ink/60" : "text-muted")}>{p.elo}</span>}
              </button>
            );
          })}
        </div>
        {n < 4 && <span className="font-body text-xs text-muted">{R.pickMin}</span>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Stepper label={R.mats} value={mats} min={1} max={8} onChange={setMats} />
        <Stepper
          label={R.rounds}
          value={r}
          min={1}
          max={30}
          onChange={(v) => setRounds(v)}
          hint={mode === "americano" && rounds === null && n >= 4 ? R.fullRotation : undefined}
        />
      </div>

      {n >= 4 && (
        <div className="flex flex-col gap-0.5 px-3.5 py-3 rounded-[14px] bg-surface-deep border border-dashed border-cream/14">
          <span className="font-heading font-bold text-[15px]">{format(R.preview, { r, g: totalGames, m: minutes })}</span>
          {n % 4 > 0 && <span className="font-body text-xs text-muted">{format(R.previewByes, { b: n % 4 })}</span>}
        </div>
      )}

      <button
        type="button"
        disabled={!ready || pending}
        onClick={submit}
        className="mt-auto h-14.5 rounded-lg bg-amber text-ink font-heading font-extrabold text-[19px] tracking-[0.05em] uppercase disabled:bg-surface-raised disabled:text-muted"
      >
        {pending ? R.building : R.start}
      </button>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: Readonly<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }>) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-[14px] bg-surface-deep border border-line">
      <span className="font-heading font-semibold text-[11px] tracking-[0.14em] uppercase text-muted">{label}</span>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-11 h-9 rounded-[10px] border border-line-strong bg-surface-raised text-cream text-lg font-bold disabled:opacity-40"
        >
          −
        </button>
        <span className="font-display font-extrabold text-[26px]">{value}</span>
        <button
          type="button"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-11 h-9 rounded-[10px] border border-line-strong bg-surface-raised text-cream text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
      <span className="font-body text-[11px] text-gold/80 min-h-4">{hint}</span>
    </div>
  );
}
