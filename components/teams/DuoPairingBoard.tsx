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
}: Readonly<{
  players: TeamPlayer[];
  teams: Duo[];
  onChange: (teams: Duo[]) => void;
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
        <div key={t.id} className="rounded-lg bg-cream/5 border border-cream/10 p-3.5 pb-4">
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
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono font-semibold text-[10px] tracking-kicker uppercase text-cream/70 focus:text-cream"
            />
          </div>
          <div className="flex gap-2.5">
            {t.players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => tapPlayer(p.id)}
                className={cn(
                  "flex-1 h-16 rounded-md font-heading font-semibold text-lg flex items-center justify-center",
                  selectedPlayerId === p.id
                    ? "bg-gold/20 border-2 border-gold text-gold"
                    : "bg-cream/8 border-2 border-transparent text-cream",
                )}
              >
                {shortNames[p.id] ?? p.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={shuffleDuos}
        className="h-13 rounded-md border-2 border-dashed border-cream/22 flex items-center justify-center gap-2 font-heading font-bold text-base tracking-[1.6px] uppercase text-cream/65"
      >
        ↻ Shuffle the duos
      </button>
    </div>
  );
}
