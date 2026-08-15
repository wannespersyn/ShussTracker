import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { games, gameTeams, gameTeamPlayers, shots } from "@/lib/db/schema";
import { assertTwoPlayersPerTeam } from "@/lib/db/authz";

export type FieldHit = "1" | "2" | "3" | "mama" | "miss";

export type GameTeamInput = { label: string; playerIds: string[]; finalRank: number };

export type CreateGameInput = {
  groupId: string;
  eventId?: string;
  createdBy: string;
  matType: "4" | "8";
  teams: GameTeamInput[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

export type CreatedGameTeam = { gameTeamId: string; label: string; playerIds: string[]; finalRank: number };

/** Persists a finished game: game + teams + team-players + shots, in one
 * atomic HTTP batch (neon-http has no interactive transaction — every id
 * is generated client-side up front so the whole write can be a single
 * dependency-free batch instead). Shared by casual game logging
 * (`app/(app)/log/actions.ts`) and tournament match play
 * (`app/(app)/tournaments/[tournamentId]/match/[matchId]/actions.ts`). */
export async function createGameRecord(
  input: CreateGameInput,
): Promise<{ gameId: string; teams: CreatedGameTeam[] }> {
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
      ...(input.eventId ? { eventId: input.eventId } : {}),
      createdBy: input.createdBy,
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

  return {
    gameId,
    teams: teamInserts.map(({ gameTeamId, team }) => ({
      gameTeamId,
      label: team.label,
      playerIds: team.playerIds,
      finalRank: team.finalRank,
    })),
  };
}
