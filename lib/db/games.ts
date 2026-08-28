import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { games, gameTeams, gameTeamPlayers, shots } from "@/lib/db/schema";
import { assertValidTeamSize } from "@/lib/db/authz";

export type FieldHit = "1" | "2" | "3" | "mama" | "miss";

export type GameTeamInput = { label: string; playerIds: string[]; finalRank: number };

export type CreateGameInput = {
  groupId: string;
  eventId?: string;
  createdBy: string;
  matType: "2" | "4" | "8";
  teams: GameTeamInput[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

export type CreatedGameTeam = { gameTeamId: string; label: string; playerIds: string[]; finalRank: number };

/** Persists a finished game: game + teams + team-players + shots, in one
 * atomic write (see `runAtomic` — every id is generated client-side up
 * front so the whole write is dependency-free either way). Shared by casual
 * game logging (`app/(app)/log/actions.ts`) and tournament match play
 * (`app/(app)/tournaments/[tournamentId]/match/[matchId]/actions.ts`). */
export async function createGameRecord(
  input: CreateGameInput,
): Promise<{ gameId: string; teams: CreatedGameTeam[] }> {
  input.teams.forEach((t) => assertValidTeamSize(t.playerIds, input.matType));

  const gameId = randomUUID();
  const playerIdToGameTeamPlayerId = new Map<string, string>();

  const teamInserts = input.teams.map((team) => {
    const gameTeamId = randomUUID();
    for (const playerId of team.playerIds) {
      playerIdToGameTeamPlayerId.set(playerId, randomUUID());
    }
    return { gameTeamId, team };
  });

  await runAtomic((executor) => [
    executor.insert(games).values({
      id: gameId,
      groupId: input.groupId,
      ...(input.eventId ? { eventId: input.eventId } : {}),
      createdBy: input.createdBy,
      matType: input.matType,
    }),
    ...teamInserts.map(({ gameTeamId, team }) =>
      executor.insert(gameTeams).values({
        id: gameTeamId,
        gameId,
        teamLabel: team.label,
        finalRank: team.finalRank,
      }),
    ),
    ...teamInserts.flatMap(({ gameTeamId, team }) =>
      team.playerIds.map((playerId) =>
        executor.insert(gameTeamPlayers).values({
          id: playerIdToGameTeamPlayerId.get(playerId)!,
          gameTeamId,
          userId: playerId,
        }),
      ),
    ),
    ...(input.shotsByPlayer.length > 0
      ? [
          executor.insert(shots).values(
            input.shotsByPlayer.map((s) => ({
              gameTeamPlayerId: playerIdToGameTeamPlayerId.get(s.playerId)!,
              fieldHit: s.fieldHit,
            })),
          ),
        ]
      : []),
  ]);

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

export type RematchSource = {
  groupId: string | null;
  eventId: string | null;
  createdBy: string;
  teams: { label: string; players: { id: string; name: string }[] }[];
};

/** The team composition of a finished game, for the "Rematch" button — same
 * players, same duos, but a fresh game record (a new result, not a replay
 * of the old one). */
export async function getGameForRematch(gameId: string): Promise<RematchSource | null> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    with: { teams: { with: { players: { with: { user: true } } } } },
  });
  if (!game) return null;

  return {
    groupId: game.groupId,
    eventId: game.eventId,
    createdBy: game.createdBy,
    teams: game.teams.map((t) => ({
      label: t.teamLabel,
      players: t.players.map((p) => ({ id: p.userId, name: p.user.name ?? "Player" })),
    })),
  };
}
