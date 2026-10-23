"use client";

import { useMemo, useState } from "react";
import { capRingPairs } from "@/lib/theme/tokens";
import { shortNamesFor } from "@/lib/format";
import { cn } from "@/lib/cn";
import { shuffleIntoDuos, type Duo, type TeamPlayer } from "@/lib/teams";

/** "Tap two names to swap, or shuffle" board — the duo-pairing interaction
 * shared by the log-game wizard, Chwazi, and tournament entrant setup. */
export function DuoPairingBoard({
  players,
  teams,
  onChange,
  hideShuffle = false,
}: Readonly<{
  players: TeamPlayer[];
  teams: Duo[];
  onChange: (teams: Duo[]) => void;
  /** The caller renders its own shuffle/balance controls (log wizard). */
  hideShuffle?: boolean;
}>) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const shortNames = useMemo(() => shortNamesFor(players), [players]);

  function tapPlayer(playerId: string) {
    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
      return;
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }
    const flat = teams.flatMap((t) => t.players);
    const a = flat.find((p) => p.id === selectedPlayerId)!;
    const b = flat.find((p) => p.id === playerId)!;
    onChange(
      teams.map((t) => ({
        ...t,
        players: t.players.map((p) => (p.id === a.id ? b : p.id === b.id ? a : p)),
      })),
    );
    setSelectedPlayerId(null);
  }

  function shuffleDuos() {
    onChange(shuffleIntoDuos(players));
    setSelectedPlayerId(null);
  }

  function renameTeam(teamId: string, label: string) {
    onChange(teams.map((t) => (t.id === teamId ? { ...t, label } : t)));
  }

  return (
    <div className="flex flex-col gap-3.5">
      {teams.map((t, i) => (
        <div key={t.id} className="rounded-[14px] bg-surface-deep border border-line p-3 pb-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-3.5 h-3.5 rounded-pill shrink-0" style={{ background: capRingPairs[t.color].light }} />
            <input
              type="text"
              value={t.label}
              onChange={(e) => renameTeam(t.id, e.target.value)}
              onBlur={(e) => {
                if (e.target.value.trim() === "") renameTeam(t.id, `Team ${i + 1}`);
              }}
              placeholder={`Team ${i + 1}`}
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-heading font-semibold text-[12px] tracking-[0.14em] uppercase text-muted focus:text-cream"
            />
          </div>
          <div className="flex gap-2.5">
            {t.players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => tapPlayer(p.id)}
                className={cn(
                  "flex-1 h-12 rounded-md font-body font-semibold text-[15px] flex items-center justify-center",
                  selectedPlayerId === p.id
                    ? "bg-amber/20 border-2 border-gold text-gold"
                    : "bg-surface-raised border-2 border-transparent text-cream",
                )}
              >
                {shortNames[p.id] ?? p.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!hideShuffle && (
      <button
        type="button"
        onClick={shuffleDuos}
        className="h-11 rounded-md border border-dashed border-cream/25 flex items-center justify-center gap-2 font-heading font-bold text-sm tracking-[0.1em] uppercase text-soft"
      >
        ↻ Shuffle the duos
      </button>
      )}
    </div>
  );
}
