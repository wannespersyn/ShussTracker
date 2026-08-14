"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { games, gameTeams, gameTeamPlayers, shots } from "@/lib/db/schema";
import { requireUserId, requireGroupMember, assertTwoPlayersPerTeam } from "@/lib/db/authz";

type FieldHit = "1" | "2" | "3" | "mama" | "miss";

export type LogGameInput = {
  groupId: string;
  matType: "4" | "8";
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

/** Persists a finished game: game + teams + team-players + shots, in one
 * atomic HTTP batch (neon-http has no interactive transaction — every id
 * is generated client-side up front so the whole write can be a single
 * dependency-free batch instead). */
export async function logGame(input: LogGameInput) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);
  input.teams.forEach((t) => assertTwoPlayersPerTeam(t.playerIds));

  const gameId = randomUUID();
  const playerIdToGameTeamPlayerId = new Map<string, string>();

  const teamInserts = input.teams.map((team) => {
    const gameTeamId = randomUUID();
    for (const playerId of team.playerIds) {
      playerIdToGameTeamPlayerId.set(playerId, randomUUID());
    }
    return { gameTeamId, team };
  });

  const [firstStatement, ...restStatements] = [
    db.insert(games).values({
      id: gameId,
      groupId: input.groupId,
      createdBy: userId,
      matType: input.matType,
    }),
    ...teamInserts.map(({ gameTeamId, team }) =>
      db.insert(gameTeams).values({
        id: gameTeamId,
        gameId,
        teamLabel: team.label,
        finalRank: team.finalRank,
      }),
    ),
    ...teamInserts.flatMap(({ gameTeamId, team }) =>
      team.playerIds.map((playerId) =>
        db.insert(gameTeamPlayers).values({
          id: playerIdToGameTeamPlayerId.get(playerId)!,
          gameTeamId,
          userId: playerId,
        }),
      ),
    ),
    ...(input.shotsByPlayer.length > 0
      ? [
          db.insert(shots).values(
            input.shotsByPlayer.map((s) => ({
              gameTeamPlayerId: playerIdToGameTeamPlayerId.get(s.playerId)!,
              fieldHit: s.fieldHit,
            })),
          ),
        ]
      : []),
  ];

  await db.batch([firstStatement, ...restStatements]);

  redirect(`/game/${gameId}`);
}
