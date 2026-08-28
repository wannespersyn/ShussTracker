"use client";

import { useMemo, useState } from "react";
import { BackButton, LinkButton, PrimaryButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { balanceIntoDuos, TEAM_COLORS, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer } from "@/lib/teams";
import { capRingGradient } from "@/lib/theme/tokens";
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
}: Readonly<{ groupId: string; eventId?: string; roster: RosterPlayer[]; ratings?: Record<string, number> }>) {
  const players = useMemo(() => toTeamPlayers(roster), [roster]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    players.length % 2 === 0 ? players.map((p) => p.id) : [],
  );
  const [phase, setPhase] = useState<"select" | "shuffling" | "result">("select");
  const [teams, setTeams] = useState<Duo[] | null>(null);
  const [balanced, setBalanced] = useState(false);

  const canShuffle = selectedIds.length >= 4 && selectedIds.length % 2 === 0;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const tournamentHref = `/tournaments/new?crewId=${groupId}${eventQuery}&entrants=${flatIds}`;

  return (
    <div className="relative min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${groupId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            Chwazi
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Pick teams</div>
        </div>
      </header>

      {phase === "select" && (
        <>
          <div className="font-body text-body-sm text-cream/55">
            Who&apos;s in? Pick an even number of players — {selectedIds.length} selected.
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

          <button
            type="button"
            onClick={() => setBalanced((v) => !v)}
            className={cn(
              "mt-auto flex items-center justify-between h-13 px-4 rounded-md border-2",
              balanced ? "bg-gold/12 border-gold/45" : "bg-cream/5 border-cream/10",
            )}
          >
            <span className="text-left">
              <span className={cn("block font-heading font-bold text-sm", balanced ? "text-gold" : "text-cream/70")}>
                Balance by skill
              </span>
              <span className="block font-body text-[12px] text-cream/45 mt-0.5">
                {balanced ? "Strongest paired with weakest" : "Pure random — the classic chwazi"}
              </span>
            </span>
            <span
              className={cn(
                "w-11 h-6.5 rounded-pill relative shrink-0",
                balanced ? "bg-gold" : "bg-cream/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 left-1 w-4.5 h-4.5 rounded-pill bg-cream transition-transform",
                  balanced && "translate-x-4.5",
                )}
              />
            </span>
          </button>

          <PrimaryButton className="h-16 w-full" size="lg" disabled={!canShuffle} onClick={chwazi}>
            Chwazi!
          </PrimaryButton>
        </>
      )}

      {phase === "shuffling" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="flex gap-3">
            {TEAM_COLORS.map((color, i) => (
              <div
                key={color}
                className="w-12 h-12 rounded-pill animate-pop"
                style={{ background: capRingGradient(color), animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <div className="font-heading font-bold text-[13px] tracking-[2px] uppercase text-cream/50">
            Shuffling…
          </div>
        </div>
      )}

      {phase === "result" && teams && (
        <>
          <div className="font-body text-body-sm text-cream/55">Tap two names to swap, or shuffle again.</div>
          <DuoPairingBoard players={teams.flatMap((t) => t.players)} teams={teams} onChange={setTeams} />
          <div className="mt-auto flex flex-col gap-2.5">
            <LinkButton href={logHref}>Log a game with these teams</LinkButton>
            {teams.length >= 2 && (
              <LinkButton href={tournamentHref} variant="outline">
                Start a tournament with these teams
              </LinkButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}
