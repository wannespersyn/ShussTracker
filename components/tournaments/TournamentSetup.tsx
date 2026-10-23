/**
 * TournamentSetup
 *
 * New-tournament wizard: pick players, shuffle into duos, choose a format
 * (with live match counts per format) and create the bracket.
 *
 * Data: calls createTournamentAction (server action), which redirects.
 * Notes: double elim needs a power-of-two duo count; copy lives in t.tour.
 */
"use client";

import { useMemo, useState, useTransition } from "react";
import { BackButton, PrimaryButton } from "@/components/ui";
import { DuoPairingBoard } from "@/components/teams/DuoPairingBoard";
import { pairIntoDuos, shuffleIntoDuos, toTeamPlayers, type Duo, type RosterPlayer, type TeamPlayer } from "@/lib/teams";
import { cn } from "@/lib/cn";
import { createTournamentAction } from "@/app/(app)/tournaments/new/actions";
import type { TournamentFormat } from "@/lib/db/tournaments";
import { useT } from "@/lib/i18n/client";
import { format as fmt, type Dictionary } from "@/lib/i18n";

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
function formatOptionsFor(duoCount: number, T: Dictionary["tour"]): FormatOption[] {
  const singleGames = Math.max(duoCount - 1, 0);
  const doubleGames = Math.max(duoCount * 2 - 2, 0);
  const robinGames = Math.round((duoCount * (duoCount - 1)) / 2);
  const doubleValid = duoCount >= 4 && (duoCount & (duoCount - 1)) === 0;

  const v = { n: duoCount };
  return [
    {
      value: "single_elim",
      label: T.singleLabel,
      tagline: T.singleTag,
      preview: fmt(T.singlePreview, { n: duoCount, g: singleGames }),
      suggestion: duoCount >= 6 ? T.singleBest : T.singleDefault,
    },
    {
      value: "double_elim",
      label: T.doubleLabel,
      tagline: T.doubleTag,
      preview: doubleValid ? fmt(T.doublePreview, { n: duoCount, g: doubleGames }) : T.doubleNeeds,
      suggestion: doubleValid ? (duoCount <= 8 ? T.doubleBest : T.doubleLong) : fmt(T.doubleFix, v),
      disabledReason: doubleValid ? undefined : fmt(T.doubleReason, v),
    },
    {
      value: "round_robin",
      label: T.robinLabel,
      tagline: T.robinTag,
      preview: fmt(T.robinPreview, { n: duoCount, g: robinGames }),
      suggestion: duoCount <= 6 ? T.robinBest : fmt(T.robinLong, { n: duoCount, g: robinGames }),
    },
  ];
}

export function TournamentSetup({
  groupId,
  roster,
  presetEntrantIds,
}: Readonly<{ groupId: string; roster: RosterPlayer[]; presetEntrantIds?: string[] }>) {
  const [isPending, startTransition] = useTransition();
  const { t } = useT();
  const T = t.tour;
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
  const [name, setName] = useState(T.defaultName);
  const [format, setFormat] = useState<TournamentFormat>("single_elim");

  const canShuffle = selectedIds.length >= 4 && selectedIds.length % 2 === 0;
  const formatOptions = useMemo(() => formatOptionsFor(teams?.length ?? 0, T), [teams, T]);
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
        name: name.trim() || T.defaultName,
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
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-muted">
            {T.newKicker}
          </div>
          <div className="font-display text-display-sm text-cream mt-1">{T.setBracket}</div>
        </div>
      </header>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={T.namePh}
        className="h-13 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-muted outline-none border-2 border-transparent focus:border-gold/40"
      />

      {!teams ? (
        <>
          <div className="font-body text-body-sm text-muted">
            {fmt(T.pickEven, { n: selectedIds.length })}
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
                    picked ? "bg-gold text-ink" : "bg-cream/8 text-soft",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex flex-col gap-2.5">
            <PrimaryButton className="h-16 w-full" size="lg" disabled={!canShuffle} onClick={shuffle}>
              {T.shuffle}
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <div className="font-body text-body-sm text-muted">
            {fmt(T.duosSwap, { n: teams.length })}
          </div>
          <DuoPairingBoard players={teams.flatMap((t) => t.players)} teams={teams} onChange={setTeams} />

          <div className="flex flex-col gap-2.5">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-muted">
              {T.pickFormat}
            </div>
            <div className="flex flex-col gap-2.5">
              {formatOptions.map((opt) => (
                <FormatTile key={opt.value} option={opt} selected={format === opt.value} onClick={() => setFormat(opt.value)} />
              ))}
            </div>
          </div>

          <PrimaryButton className="mt-auto h-16 w-full" size="lg" disabled={isPending || !canStart} onClick={start}>
            {isPending ? T.building : T.start}
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
  const { t } = useT();
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
            {t.tour.selected}
          </span>
        )}
      </div>
      <div className="font-body text-[14px] text-soft">{option.tagline}</div>
      <div className="font-mono font-medium text-[11.5px] tracking-wide text-muted">{option.preview}</div>
      <div className={cn("font-body text-[13px] mt-0.5", disabled ? "text-red-pale" : "text-gold/80")}>
        {option.disabledReason ?? option.suggestion}
      </div>
    </button>
  );
}
