"use client";

import { useMemo, useState, useTransition } from "react";
import { BackButton, LinkButton, PrimaryButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { pairIntoDuos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { cn } from "@/lib/cn";
import { createTournamentAction } from "@/app/(app)/tournaments/new/actions";
import type { TournamentFormat } from "@/lib/db/tournaments";

type FormatOption = {
  value: TournamentFormat;
  label: string;
  tagline: string;
  preview: string;
  suggestion: string;
  disabledReason?: string;
};

/** Live preview + "what fits best" copy per format, computed from the
 * actual duo count — not generic marketing text. Double elim additionally
 * needs an exact power-of-two duo count (see `lib/db/tournaments.ts`), so
 * it's disabled with a concrete instruction when the count doesn't fit. */
function formatOptionsFor(duoCount: number): FormatOption[] {
  const singleGames = Math.max(duoCount - 1, 0);
  const doubleGames = Math.max(duoCount * 2 - 2, 0);
  const robinGames = Math.round((duoCount * (duoCount - 1)) / 2);
  const doubleValid = duoCount >= 4 && (duoCount & (duoCount - 1)) === 0;

  return [
    {
      value: "single_elim",
      label: "SINGLE ELIM",
      tagline: "One loss and you're out.",
      preview: `${duoCount} duos · ${singleGames} matches to a champion`,
      suggestion:
        duoCount >= 6
          ? "Best fit — fastest way to a winner with this many duos."
          : "Solid default — quick and decisive.",
    },
    {
      value: "double_elim",
      label: "DOUBLE ELIM",
      tagline: "Lose twice before you're out.",
      preview: doubleValid
        ? `${duoCount} duos · up to ${doubleGames} matches, room for a comeback`
        : "Needs 4, 8, 16… duos",
      suggestion: doubleValid
        ? duoCount <= 8
          ? "Best fit — forgiving bracket for a medium field."
          : "Works, but it'll be a longer night."
        : `You have ${duoCount} — add or drop a duo to reach a power of two.`,
      disabledReason: doubleValid ? undefined : `Needs an exact power-of-two duo count (4, 8, 16…) — you have ${duoCount}.`,
    },
    {
      value: "round_robin",
      label: "ROUND ROBIN",
      tagline: "Everyone plays everyone, ranked by wins.",
      preview: `${duoCount} duos · ${robinGames} matches total`,
      suggestion:
        duoCount <= 6
          ? "Best fit — nobody's eliminated early."
          : `That's ${robinGames} matches — a long night for ${duoCount} duos.`,
    },
  ];
}

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
  const [format, setFormat] = useState<TournamentFormat>("single_elim");

  const canShuffle = selectedIds.length >= 4 && selectedIds.length % 2 === 0;
  const eventQuery = eventId ? `&eventId=${eventId}` : "";
  const chwaziHref = `/chwazi?crewId=${groupId}${eventQuery}`;
  const formatOptions = useMemo(() => formatOptionsFor(teams?.length ?? 0), [teams]);
  const selectedFormatOption = formatOptions.find((f) => f.value === format);
  const canStart = Boolean(teams) && teams!.length >= 2 && !selectedFormatOption?.disabledReason;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTeams(null);
  }

  function shuffle() {
    if (!canShuffle) return;
    setTeams(shuffleIntoDuos(players.filter((p) => selectedIds.includes(p.id))));
  }

  function start() {
    if (!canStart || !teams) return;
    startTransition(() => {
      createTournamentAction({
        groupId,
        eventId,
        name: name.trim() || "Tournament",
        format,
        entrantPairs: teams.map((t) => [t.players[0]!.id, t.players[1]!.id] as [string, string]),
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
          <div className="mt-auto flex flex-col gap-2.5">
            <PrimaryButton className="h-16 w-full" size="lg" disabled={!canShuffle} onClick={shuffle}>
              Shuffle into duos
            </PrimaryButton>
            <LinkButton href={chwaziHref} variant="outline">
              Or use Chwazi (balance by skill)
            </LinkButton>
          </div>
        </>
      ) : (
        <>
          <div className="font-body text-body-sm text-cream/55">
            {teams.length} duos. Tap two names to swap.
          </div>
          <DuoPairingBoard players={teams.flatMap((t) => t.players)} teams={teams} onChange={setTeams} />

          <div className="flex flex-col gap-2.5">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Pick a format
            </div>
            <div className="flex flex-col gap-2.5">
              {formatOptions.map((opt) => (
                <FormatTile key={opt.value} option={opt} selected={format === opt.value} onClick={() => setFormat(opt.value)} />
              ))}
            </div>
          </div>

          <PrimaryButton className="mt-auto h-16 w-full" size="lg" disabled={isPending || !canStart} onClick={start}>
            {isPending ? "Building bracket…" : "Start tournament"}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

function FormatTile({
  option,
  selected,
  onClick,
}: Readonly<{ option: FormatOption; selected: boolean; onClick: () => void }>) {
  const disabled = Boolean(option.disabledReason);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl p-4.5 flex flex-col gap-1.5 text-left border-2",
        disabled
          ? "bg-cream/3 border-cream/8 opacity-55"
          : selected
            ? "bg-gradient-alt border-gold"
            : "bg-cream/5 border-cream/10",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-xl tracking-[0.4px] text-cream">{option.label}</div>
        {selected && !disabled && (
          <span className="font-mono font-semibold text-[10px] tracking-widest uppercase text-gold shrink-0">
            Selected
          </span>
        )}
      </div>
      <div className="font-body text-[14px] text-cream/70">{option.tagline}</div>
      <div className="font-mono font-medium text-[11.5px] tracking-wide text-cream/45">{option.preview}</div>
      <div className={cn("font-body text-[13px] mt-0.5", disabled ? "text-red-pale" : "text-gold/80")}>
        {option.disabledReason ?? option.suggestion}
      </div>
    </button>
  );
}
