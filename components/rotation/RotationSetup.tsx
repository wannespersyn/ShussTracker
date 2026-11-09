/**
 * RotationSetup
 *
 * New Americano / Mexicano (design "Shussapp Americano" · 1): name, format
 * tiles, player grid with Elo, mats and rounds steppers, an overview of
 * rounds / games / duration and a sticky start button.
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

function duration(min: number, locale: string) {
  if (min < 60) return `±${min} min`;
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return locale === "nl" ? `±${h}u${m}` : `±${h}h${m}`;
}

export function RotationSetup({
  groupId,
  roster,
  presetIds,
}: Readonly<{ groupId: string; roster: { id: string; name: string; elo: number; games: number }[]; presetIds?: string[] }>) {
  const { t, locale } = useT();
  const R = t.rot;
  const [pending, start] = useTransition();
  const [name, setName] = useState(R.defaultName);
  const [mode, setMode] = useState<RotationMode>("americano");
  const [picked, setPicked] = useState<string[]>(() => (presetIds ?? []).filter((id) => roster.some((p) => p.id === id)));
  const [mats, setMats] = useState(1);
  const [rounds, setRounds] = useState<number | null>(null); // null = full rotation / default

  const n = picked.length;
  const defaultRounds = mode === "americano" ? fullRotationRounds(n) : Math.min(Math.max(n - 1, 3), 8);
  const r = rounds ?? defaultRounds;
  const perRound = gamesPerRound(n);
  const totalGames = perRound * r;
  const minutes = Math.ceil(perRound / Math.max(1, mats)) * r * MINUTES_PER_GAME;
  const ready = n >= 4 && r >= 1;
  const full = mode === "americano" && r >= fullRotationRounds(n) && (n % 4 === 0 || n % 4 === 1);
  const byes = n % 4;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit() {
    if (!ready) return;
    start(() => createRotationAction({ groupId, name, mode, playerIds: picked, mats, rounds: r }));
  }

  const kicker = "font-heading font-bold text-[12px] tracking-[0.14em] text-muted";

  return (
    <div className="relative min-h-screen bg-surface w-full max-w-xl mx-auto">
      <div className="flex flex-col gap-5.5 px-5 pt-4.5 pb-32">
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
            <span className={kicker}>{R.kicker}</span>
            <h1 className="font-display font-extrabold text-[28px] leading-none tracking-[0.02em] uppercase">{R.newTitle}</h1>
          </span>
        </header>

        <label className="flex flex-col gap-1.5">
          <span className={kicker}>{R.name}</span>
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={R.namePh}
            className="h-13 rounded-[14px] bg-surface-deep border border-line-strong px-4 font-heading font-bold text-[22px] tracking-[0.02em] text-cream placeholder:text-muted outline-none focus:border-gold/50"
          />
        </label>

        <section aria-label={R.mode} className="flex flex-col gap-2">
          <span className={kicker}>{R.mode}</span>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ["americano", R.americano, R.americanoSub, "M4 9h12l-3-3M20 15H8l3 3"],
                ["mexicano", R.mexicano, R.mexicanoSub, "M5 20v-6M12 20V8M19 20V4"],
              ] as const
            ).map(([id, label, sub, icon]) => {
              const on = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setMode(id);
                    setRounds(null);
                  }}
                  className={cn(
                    "flex flex-col gap-2.5 p-3.5 rounded-[16px] border-2 text-left text-cream",
                    on ? "border-gold bg-amber/10" : "border-line bg-surface-deep",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={on ? "text-gold" : "text-muted"}>
                      <path d={icon} />
                    </svg>
                    {on && (
                      <span className="w-5.5 h-5.5 rounded-pill bg-amber text-ink flex items-center justify-center">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="font-display font-extrabold text-[22px] leading-none uppercase">{label}</span>
                  <span className={cn("font-body text-[13px] leading-snug", on ? "text-soft" : "text-muted")}>{sub}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label={R.players} className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className={kicker}>
              {R.players} · <span className="text-gold">{format(R.picked, { n })}</span>
            </span>
            <button
              type="button"
              onClick={() => setPicked(picked.length === roster.length ? [] : roster.map((p) => p.id))}
              className="py-2 font-heading font-bold text-[13px] tracking-[0.1em] text-gold"
            >
              {picked.length === roster.length ? R.none : R.all}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {roster.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 rounded-[14px] border text-cream",
                    on ? "bg-surface-deep border-gold/35" : "border-line opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "w-11.5 h-11.5 rounded-pill flex items-center justify-center font-display font-extrabold text-[17px] uppercase",
                      on ? "bg-amber text-ink shadow-[0_0_0_3px_var(--color-surface),0_0_0_5px_var(--color-gold)]" : "bg-chip text-muted",
                    )}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <span className="max-w-full truncate font-body font-semibold text-[13px] leading-tight">{firstName(p.name)}</span>
                  <span className="font-heading font-semibold text-[12px] text-muted">{p.games > 0 ? p.elo : "—"}</span>
                </button>
              );
            })}
          </div>
          {n < 4 && <span className="font-body text-xs text-muted">{R.pickMin}</span>}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Stepper
            label={R.mats}
            value={mats}
            min={1}
            max={8}
            onChange={setMats}
            hint={mats === 1 ? R.matsSubOne : format(R.matsSub, { n: mats })}
          />
          <Stepper
            label={R.rounds}
            value={r}
            min={1}
            max={30}
            onChange={(v) => setRounds(v)}
            hint={full ? R.fullRotation : undefined}
            accentHint
          />
        </div>

        {n >= 4 && (
          <section aria-label={R.statRounds} className="flex flex-col gap-3 p-4 rounded-[16px] bg-surface-deep border border-dashed border-cream/18">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [String(r), R.statRounds],
                  [String(totalGames), R.statGames],
                  [duration(minutes, locale), R.statTime],
                ] as const
              ).map(([v, k]) => (
                <span key={k} className="flex flex-col gap-0.5">
                  <span className="font-display font-extrabold text-[34px] leading-none">{v}</span>
                  <span className="font-heading font-bold text-[11px] tracking-[0.14em] text-muted">{k}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 font-body text-sm text-soft">
              {full && (
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="text-mint">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  {R.everyone}
                </span>
              )}
              {byes > 0 && (
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-muted">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {format(R.byesFair, { n: byes })}
                </span>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-xl mx-auto px-5 pt-3.5 pb-[calc(26px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_top,var(--color-surface)_70%,transparent)]">
          <button
            type="button"
            disabled={!ready || pending}
            onClick={submit}
            className="w-full h-14.5 rounded-[16px] bg-amber text-ink flex items-center justify-center gap-2.5 font-heading font-extrabold text-xl tracking-[0.06em] uppercase disabled:bg-surface-raised disabled:text-muted"
          >
            {pending ? R.building : format(R.start, { mode: mode === "americano" ? R.americano : R.mexicano })}
            {!pending && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </div>
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
  accentHint = false,
}: Readonly<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string; accentHint?: boolean }>) {
  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-[16px] bg-surface-deep border border-line">
      <span className="font-heading font-bold text-[12px] tracking-[0.14em] text-muted">{label}</span>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-11 h-11 rounded-[12px] border border-line-strong bg-surface-raised text-cream text-[22px] font-bold disabled:opacity-40"
        >
          −
        </button>
        <span className="font-display font-extrabold text-5xl leading-none tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-11 h-11 rounded-[12px] border border-gold/45 bg-amber/13 text-gold text-[22px] font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
      <span className={cn("font-body text-xs min-h-4", accentHint ? "text-gold font-semibold" : "text-muted")}>{hint}</span>
    </div>
  );
}
