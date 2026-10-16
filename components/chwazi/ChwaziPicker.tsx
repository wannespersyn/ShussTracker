"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BackButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { balanceIntoDuos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer } from "@/lib/teams";
import { cn } from "@/lib/cn";

/** Random team picker ("chwazi" — the finger-picking randomizer game this
 * is named after). Select who's in, shuffle into duos, then hand the
 * result off to a casual game or a tournament via query params.
 *
 * `ratings` (crew Elo, keyed by userId) is optional — passing it in enables
 * the "balance by skill" toggle, which pairs strongest-with-weakest instead
 * of pure random so nobody's duo is a runaway stack or a guaranteed loss. */
export function ChwaziPicker({
  groupId,
  eventId,
  roster,
  ratings = {},
  requiredCount,
}: Readonly<{
  groupId: string;
  eventId?: string;
  roster: RosterPlayer[];
  ratings?: Record<string, number>;
  /** Locks selection to an exact player count — set when Chwazi is invoked
   * from a flow that's already fixed the mat size (the log wizard's duo
   * mats), so there's nothing to pick beyond who's actually playing.
   * Omitted (e.g. tournament entrants), selection is any even number ≥ 4. */
  requiredCount?: number;
}>) {
  const players = useMemo(() => toTeamPlayers(roster), [roster]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<"select" | "shuffling" | "result">("select");
  const [teams, setTeams] = useState<Duo[] | null>(null);
  const [balanced, setBalanced] = useState(false);

  const canShuffle = requiredCount
    ? selectedIds.length === requiredCount
    : selectedIds.length >= 4 && selectedIds.length % 2 === 0;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (requiredCount && prev.length >= requiredCount) return prev;
      return [...prev, id];
    });
  }

  function chwazi() {
    if (!canShuffle) return;
    setPhase("shuffling");
    setTimeout(() => {
      const picked = players.filter((p) => selectedIds.includes(p.id));
      setTeams(balanced ? balanceIntoDuos(picked, ratings) : shuffleIntoDuos(picked));
      setPhase("result");
    }, 900);
  }

  const flatIds = teams?.flatMap((t) => t.players.map((p) => p.id)).join(",") ?? "";
  const eventQuery = eventId ? `&eventId=${eventId}` : "";
  const logHref = `/log?crewId=${groupId}${eventQuery}&teams=${flatIds}`;

  const shortNames = Object.fromEntries(players.map((p) => [p.id, p.name.trim().split(/\s+/)[0].length <= 3 ? p.name : p.name.trim().split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase())]));
  const need = requiredCount ?? null;
  const countReady = canShuffle;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col gap-3.5 px-5 pt-4.5 pb-8 w-full max-w-xl mx-auto">
      <header className="flex items-center gap-3 h-11">
        <BackButton href={`/crews/${groupId}`} />
        <div className="flex-1 flex flex-col">
          <span className="font-heading font-extrabold text-[26px] tracking-[0.06em] leading-none">CHWAZI</span>
          <span className="font-body text-xs text-cream/55">
            {phase === "result" ? (balanced ? "Balanced by Elo" : "Pure luck") : "Pick who plays — Chwazi makes the teams"}
          </span>
        </div>
      </header>

      {phase === "select" && (
        <>
          <div className="flex justify-between items-baseline">
            <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-cream/55">Who&apos;s playing?</span>
            <span className={cn("font-display font-extrabold text-lg", countReady ? "text-gold" : "text-cream/55")}>
              {need ? `${selectedIds.length} / ${need}` : selectedIds.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {players.map((p) => {
              const picked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={picked}
                  className={cn(
                    "min-h-20 rounded-[14px] flex flex-col items-center justify-center gap-1 px-1 py-2 border-2 text-cream",
                    picked ? "bg-surface-raised border-gold" : "bg-surface-deep border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-pill flex items-center justify-center font-heading font-extrabold text-sm",
                      picked ? "bg-amber text-ink" : "bg-surface-raised text-cream/75",
                    )}
                  >
                    {p.initials}
                  </span>
                  <span className="font-body font-semibold text-[13px] max-w-full truncate">{shortNames[p.id]}</span>
                  {ratings[p.id] !== undefined && <span className="font-body text-[11px] text-cream/55">{Math.round(ratings[p.id])}</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setBalanced((v) => !v)}
            aria-pressed={balanced}
            className="flex items-center gap-3 min-h-15 px-3.5 py-2 rounded-[14px] bg-surface-deep border border-line text-left"
          >
            <span className="flex-1 flex flex-col">
              <span className="font-body font-semibold text-[15px]">Balance by Elo</span>
              <span className="font-body text-xs text-cream/55">Strongest with weakest — no stacked duos</span>
            </span>
            <span className={cn("w-12 h-7 rounded-pill p-0.75 flex shrink-0", balanced ? "bg-amber justify-end" : "bg-surface-raised justify-start")}>
              <span className={cn("w-5.5 h-5.5 rounded-pill", balanced ? "bg-ink" : "bg-cream/55")} />
            </span>
          </button>

          <button
            type="button"
            disabled={!canShuffle}
            onClick={chwazi}
            className="h-16 rounded-[18px] bg-amber text-ink font-heading font-extrabold text-[26px] tracking-[0.1em] disabled:bg-surface-raised disabled:text-cream/40"
          >
            {canShuffle ? "CHWAZI!" : need ? `PICK ${need - selectedIds.length} MORE` : "PICK AN EVEN NUMBER"}
          </button>
        </>
      )}

      {phase === "shuffling" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex gap-3">
            {["var(--color-amber-fill)", "#4fd1ff", "var(--color-red)", "var(--color-mint)"].map((c, i) => (
              <div key={c} className="w-12 h-12 rounded-pill animate-pop" style={{ background: c, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <div className="font-heading font-bold text-[13px] tracking-[0.2em] uppercase text-cream/55">Shuffling…</div>
        </div>
      )}

      {phase === "result" && teams && (
        <>
          <DuoPairingBoard players={teams.flatMap((t) => t.players)} teams={teams} onChange={setTeams} />
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <button
              type="button"
              onClick={chwazi}
              className="h-14 rounded-[16px] border-2 border-gold text-gold font-heading font-extrabold text-lg tracking-[0.06em]"
            >
              RESHUFFLE
            </button>
            <Link href={logHref} className="h-14 rounded-[16px] bg-amber text-ink flex items-center justify-center font-heading font-extrabold text-lg tracking-[0.06em]">
              LOG THIS GAME
            </Link>
          </div>
          <button type="button" onClick={() => setPhase("select")} className="h-11 font-body font-semibold text-sm text-cream/55">
            Change players
          </button>
        </>
      )}
    </div>
  );
}
