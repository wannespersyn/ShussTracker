"use client";

import { useMemo, useState, useTransition } from "react";
import { BackButton, PrimaryButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { pairIntoDuos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { cn } from "@/lib/cn";
import { createTournamentAction } from "@/app/(app)/tournaments/new/actions";

export function TournamentSetup({
  groupId,
  eventId,
  roster,
  presetEntrantIds,
}: Readonly<{ groupId: string; eventId?: string; roster: RosterPlayer[]; presetEntrantIds?: string[] }>) {
  const [isPending, startTransition] = useTransition();
  const players = useMemo<TeamPlayer[]>(() => toTeamPlayers(roster), [roster]);

  const presetTeams = useMemo<Duo[] | null>(() => {
    if (!presetEntrantIds || presetEntrantIds.length < 4 || presetEntrantIds.length % 2 !== 0) return null;
    const ordered = presetEntrantIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is TeamPlayer => Boolean(p));
    return ordered.length === presetEntrantIds.length ? pairIntoDuos(ordered) : null;
  }, [presetEntrantIds, players]);

  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => presetTeams?.flatMap((t) => t.players.map((p) => p.id)) ?? (players.length % 2 === 0 ? players.map((p) => p.id) : []),
  );
  const [teams, setTeams] = useState<Duo[] | null>(presetTeams);
  const [name, setName] = useState("Tournament");

  const canShuffle = selectedIds.length >= 4 && selectedIds.length % 2 === 0;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTeams(null);
  }

  function shuffle() {
    if (!canShuffle) return;
    setTeams(shuffleIntoDuos(players.filter((p) => selectedIds.includes(p.id))));
  }

  function start() {
    if (!teams || teams.length < 2) return;
    startTransition(() => {
      createTournamentAction({
        groupId,
        eventId,
        name: name.trim() || "Tournament",
        entrantPairs: teams.map((t) => [t.players[0].id, t.players[1].id] as [string, string]),
      });
    });
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${groupId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            New tournament
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Set the bracket</div>
        </div>
      </header>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tournament name"
        className="h-13 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
      />

      {!teams ? (
        <>
          <div className="font-body text-body-sm text-cream/55">
            Who&apos;s playing? Pick an even number — {selectedIds.length} selected.
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const picked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "px-4 h-11 rounded-md font-heading font-bold text-sm",
                    picked ? "bg-gold text-ink" : "bg-cream/8 text-cream/70",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <PrimaryButton className="mt-auto h-16 w-full" size="lg" disabled={!canShuffle} onClick={shuffle}>
            Shuffle into duos
          </PrimaryButton>
        </>
      ) : (
        <>
          <div className="font-body text-body-sm text-cream/55">
            {teams.length} duos · single elimination. Tap two names to swap.
          </div>
          <DuoPairingBoard players={teams.flatMap((t) => t.players)} teams={teams} onChange={setTeams} />
          <PrimaryButton
            className="mt-auto h-16 w-full"
            size="lg"
            disabled={isPending || teams.length < 2}
            onClick={start}
          >
            {isPending ? "Building bracket…" : "Start tournament"}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
