/**
 * RotationGamePlayer
 *
 * Plays one Americano/Mexicano game: the log wizard on the two planned duos,
 * result (winner, mamas, kruip, mat log) saved via playRotationGameAction.
 */
"use client";

import { LogGameWizard } from "@/components/log/LogGameWizard";
import { TEAM_COLORS, type Duo } from "@/lib/teams";
import { initialsFor } from "@/lib/format";
import { playRotationGameAction } from "@/app/(app)/americano/actions";
import type { ShotInput } from "@/lib/db/games";
import type { MatGameLog } from "@/lib/mat";
import { firstName } from "@/lib/insights";

type Side = [{ id: string; name: string }, { id: string; name: string }];

export function RotationGamePlayer({
  rotationId,
  rotationGameId,
  teamA,
  teamB,
  beta,
}: Readonly<{ rotationId: string; rotationGameId: string; teamA: Side; teamB: Side; beta: { start: boolean; celebrations: boolean; mat: boolean } }>) {
  const team = (side: Side, i: number, label: string): Duo => ({
    id: label,
    label: side.map((p) => firstName(p.name)).join(" & "),
    color: TEAM_COLORS[i],
    players: side.map((p) => ({ id: p.id, name: p.name, initials: initialsFor(p.name), ring: TEAM_COLORS[i] })),
  });
  const lockedTeams = [team(teamA, 0, "A"), team(teamB, 1, "B")];

  async function handleComplete(result: {
    teams: { label: string; playerIds: string[]; finalRank: number; kruip?: boolean }[];
    shotsByPlayer: ShotInput[];
    mat?: MatGameLog;
  }) {
    await playRotationGameAction({ rotationGameId, teams: result.teams, shotsByPlayer: result.shotsByPlayer, mat: result.mat });
  }

  return (
    <LogGameWizard
      roster={[...teamA, ...teamB]}
      lockedTeams={lockedTeams}
      onComplete={handleComplete}
      backHref={`/americano/${rotationId}`}
      beta={beta}
    />
  );
}
