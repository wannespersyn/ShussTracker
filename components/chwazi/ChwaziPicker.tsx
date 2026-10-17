"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { balanceIntoDuos, pairIntoSolos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer } from "@/lib/teams";
import { cn } from "@/lib/cn";

type Mat = "2" | "4" | "8";
const TEAM_HEX = ["var(--color-amber-fill)", "#4fd1ff", "#ff6b5b", "#c6f432"];

/** Random team picker ("chwazi" — the finger-picking randomizer game this
 * is named after). Pick the mat and who's in, then Chwazi shuffles them into
 * teams (or balances by Elo: strongest with weakest) and hands the teams to
 * the log flow. */
export function ChwaziPicker({
  groupId,
  roster,
  ratings = {},
  requiredCount,
}: Readonly<{
  groupId: string;
  roster: RosterPlayer[];
  ratings?: Record<string, number>;
  /** Player count the caller already fixed (log wizard): preselects the mat. */
  requiredCount?: number;
}>) {
  const players = useMemo(() => toTeamPlayers(roster), [roster]);
  const [mat, setMat] = useState<Mat>(requiredCount === 2 ? "2" : requiredCount === 8 ? "8" : "4");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<"select" | "shuffling" | "result">("select");
  const [teams, setTeams] = useState<Duo[] | null>(null);
  const [balanced, setBalanced] = useState(false);

  const need = Number(mat);
  const ready = selectedIds.length === need;
  const elo = (id: string) => (ratings[id] !== undefined ? Math.round(ratings[id]) : null);

  function pickMat(m: Mat) {
    setMat(m);
    setSelectedIds((prev) => prev.slice(0, Number(m)));
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= need) return prev;
      return [...prev, id];
    });
  }

  function chwazi() {
    if (!ready) return;
    setPhase("shuffling");
    setTimeout(() => {
      const picked = players.filter((p) => selectedIds.includes(p.id));
      if (mat === "2") {
        const order = [...picked].sort(() => Math.random() - 0.5);
        setTeams(pairIntoSolos(order));
      } else {
        setTeams(balanced ? balanceIntoDuos(picked, ratings) : shuffleIntoDuos(picked));
      }
      setPhase("result");
    }, 900);
  }

  const flatIds = teams?.flatMap((t) => t.players.map((p) => p.id)).join(",") ?? "";
  const logHref = `/log?crewId=${groupId}&teams=${flatIds}`;
  const shortName = (name: string) => {
    const first = name.trim().split(/\s+/)[0];
    return first.length <= 3 ? name : first.replace(/^./, (c) => c.toUpperCase());
  };
  const matName = { "2": "1 v 1", "4": "4-mat", "8": "8-mat" }[mat];

  return (
    <div className="relative min-h-screen bg-surface flex flex-col gap-3.5 px-5 pt-4.5 pb-6 w-full max-w-xl mx-auto">
      <header className="flex items-center gap-3 h-11">
        <Link
          href={`/log?crewId=${groupId}`}
          aria-label="Back to logging"
          className="w-11 h-11 shrink-0 rounded-pill bg-surface-panel border border-line-strong text-cream flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <span className="flex-1 flex flex-col">
          <span className="font-heading font-extrabold text-[26px] tracking-[0.06em]">CHWAZI</span>
          <span className="font-body text-xs text-muted">
            {phase === "result" ? `${balanced && mat !== "2" ? "Balanced by Elo" : "Pure luck"} · ${matName}` : "Pick who plays — Chwazi makes the teams"}
          </span>
        </span>
      </header>

      {phase === "select" && (
        <>
          <div role="group" aria-label="Mat" className="grid grid-cols-3 gap-1 p-1 rounded-[14px] bg-surface-panel border border-line">
            {(["2", "4", "8"] as Mat[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMat(m)}
                aria-pressed={mat === m}
                className={cn("h-11 rounded-[10px] font-heading font-bold text-[17px] tracking-[0.04em]", mat === m ? "bg-amber text-ink" : "text-muted")}
              >
                {m === "2" ? "1 V 1" : `${m}-MAT`}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-baseline">
            <span className="font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted">Who&apos;s playing?</span>
            <span className={cn("font-display font-extrabold text-lg", ready ? "text-gold" : "text-muted")}>
              {selectedIds.length} / {need}
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
                    "min-h-[92px] rounded-[14px] flex flex-col items-center justify-center gap-1 px-1 py-2 border-2 text-cream",
                    picked ? "bg-surface-raised border-gold" : "bg-surface-deep border-cream/6",
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-pill flex items-center justify-center font-heading font-extrabold text-sm",
                      picked ? "bg-amber text-ink" : "bg-chip text-soft",
                    )}
                  >
                    {p.initials}
                  </span>
                  <span className="font-body font-semibold text-[13px] max-w-full truncate">{shortName(p.name)}</span>
                  {elo(p.id) !== null && <span className="font-body text-[11px] text-muted">{elo(p.id)}</span>}
                </button>
              );
            })}
          </div>

          {mat !== "2" && (
            <button
              type="button"
              onClick={() => setBalanced((v) => !v)}
              aria-pressed={balanced}
              className="flex items-center gap-3 min-h-15 px-3.5 py-2 rounded-[14px] bg-surface-deep border border-line text-left text-cream"
            >
              <span className="flex-1 flex flex-col">
                <span className="font-body font-semibold text-[15px]">Balance by Elo</span>
                <span className="font-body text-xs text-muted">Strongest with weakest — no stacked duos</span>
              </span>
              <span className={cn("w-12 h-7 rounded-pill p-0.75 flex shrink-0", balanced ? "bg-amber justify-end" : "bg-chip justify-start")}>
                <span className={cn("w-5.5 h-5.5 rounded-pill", balanced ? "bg-ink" : "bg-muted")} />
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!ready}
            onClick={chwazi}
            className="h-16 shrink-0 rounded-[18px] bg-amber text-ink font-heading font-extrabold text-[26px] tracking-[0.1em] disabled:bg-surface-raised disabled:text-[#6b746f]"
          >
            {ready ? "CHWAZI!" : `PICK ${need - selectedIds.length} MORE`}
          </button>
        </>
      )}

      {phase === "shuffling" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex gap-3">
            {TEAM_HEX.map((c, i) => (
              <div key={c} className="w-12 h-12 rounded-pill animate-pop" style={{ background: c, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <div className="font-heading font-bold text-[13px] tracking-[0.2em] uppercase text-muted">Shuffling…</div>
        </div>
      )}

      {phase === "result" && teams && (
        <div className="flex flex-col gap-3">
          {teams.map((team, i) => {
            const color = TEAM_HEX[i % TEAM_HEX.length];
            const rated = team.players.map((p) => elo(p.id)).filter((x): x is number => x !== null);
            const avg = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : null;
            return (
              <div
                key={team.id}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-[18px] bg-surface-deep border-2 motion-safe:animate-pop"
                style={{ borderColor: color }}
              >
                <span className="font-heading font-extrabold text-sm tracking-[0.14em] [writing-mode:vertical-rl] rotate-180" style={{ color }}>
                  TEAM {i + 1}
                </span>
                <div className="flex-1 flex flex-col gap-1.5">
                  {team.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <span className="w-9 h-9 shrink-0 rounded-pill flex items-center justify-center font-heading font-extrabold text-sm text-ink" style={{ background: color }}>
                        {p.initials}
                      </span>
                      <span className="flex-1 font-body font-semibold text-base truncate">{shortName(p.name)}</span>
                      {elo(p.id) !== null && <span className="font-heading font-bold text-[15px] text-muted">{elo(p.id)}</span>}
                    </div>
                  ))}
                </div>
                {avg !== null && <span className="font-body text-xs text-muted">{team.players.length > 1 ? `Duo Elo ${avg}` : `Elo ${avg}`}</span>}
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5 mt-1">
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
          <button type="button" onClick={() => setPhase("select")} className="h-11 font-body font-semibold text-sm text-muted">
            Change players
          </button>
        </div>
      )}
    </div>
  );
}
