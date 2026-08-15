"use client";

import { LogGameWizard } from "@/components/log/LogGameWizard";
import { TEAM_COLORS, type Duo, type TeamPlayer } from "@/lib/teams";
import type { CapRingColor } from "@/lib/theme/tokens";
import { initialsFor } from "@/lib/format";
import { playTournamentMatch } from "@/app/(app)/tournaments/[tournamentId]/match/[matchId]/actions";
import type { FieldHit } from "@/lib/db/games";

type MatchTeam = {
  entrantId: string;
  label: string;
  players: [{ id: string; name: string }, { id: string; name: string }];
};

function toTeamPlayer(p: { id: string; name: string }, ring: CapRingColor): TeamPlayer {
  return { id: p.id, name: p.name, initials: initialsFor(p.name), ring };
}

/** Thin client wrapper handing LogGameWizard two bracket-fixed teams and
 * routing its result into the tournament's own bookkeeping instead of a
 * plain casual game. */
export function MatchPlayer({
  matchId,
  tournamentId,
  teamA,
  teamB,
}: Readonly<{ matchId: string; tournamentId: string; teamA: MatchTeam; teamB: MatchTeam }>) {
  const lockedTeams: Duo[] = [
    {
      id: teamA.entrantId,
      label: teamA.label,
      color: TEAM_COLORS[0],
      players: [toTeamPlayer(teamA.players[0], TEAM_COLORS[0]), toTeamPlayer(teamA.players[1], TEAM_COLORS[0])],
    },
    {
      id: teamB.entrantId,
      label: teamB.label,
      color: TEAM_COLORS[1],
      players: [toTeamPlayer(teamB.players[0], TEAM_COLORS[1]), toTeamPlayer(teamB.players[1], TEAM_COLORS[1])],
    },
  ];

  const roster = [...teamA.players, ...teamB.players];

  async function handleComplete(result: {
    matType: "4" | "8";
    teams: { label: string; playerIds: string[]; finalRank: number }[];
    shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
  }) {
    const winner = result.teams.find((t) => t.finalRank === 1)!;
    const winnerEntrantId = winner.playerIds.includes(teamA.players[0].id) ? teamA.entrantId : teamB.entrantId;

    await playTournamentMatch({
      matchId,
      teamA: { entrantId: teamA.entrantId, playerIds: [teamA.players[0].id, teamA.players[1].id] },
      teamB: { entrantId: teamB.entrantId, playerIds: [teamB.players[0].id, teamB.players[1].id] },
      winnerEntrantId,
      shotsByPlayer: result.shotsByPlayer,
    });
  }

  return (
    <LogGameWizard
      roster={roster}
      lockedTeams={lockedTeams}
      onComplete={handleComplete}
      backHref={`/tournaments/${tournamentId}`}
    />
  );
}
