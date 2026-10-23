import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { capMoves, gameRounds, gameRoundTeams, gameThrows, games, gameTeams, gameTeamPlayers, shots } from "@/lib/db/schema";
import type { MatGameLog } from "@/lib/mat";
import { assertValidTeamSize } from "@/lib/db/authz";

export type FieldHit = "1" | "2" | "3" | "mama" | "miss";

/** One logged cap. `defense` = it came from a defending flick; `ownGoal` =
 * it ended in a zone scoring for the other team (see schema `shot`). */
export type ShotInput = { playerId: string; fieldHit: FieldHit; defense?: boolean; ownGoal?: boolean };

export type GameTeamInput = { label: string; playerIds: string[]; finalRank: number };

export type CreateGameInput = {
  groupId: string;
  createdBy: string;
  matType: "2" | "4" | "8";
  teams: GameTeamInput[];
  shotsByPlayer: ShotInput[];
  /** Beta mat logger: every round, throw and cap move. Team indexes follow `teams`. */
  mat?: MatGameLog;
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

  const mat = input.mat ? matRows(input.mat, teamInserts.map((x) => x.gameTeamId), playerIdToGameTeamPlayerId, gameId) : null;

  await runAtomic((executor) => [
    executor.insert(games).values({
      id: gameId,
      groupId: input.groupId,
      createdBy: input.createdBy,
      matType: input.matType,
      matA1Corner: input.mat?.a1Corner ?? null,
      endedBy: input.mat?.endedBy ?? null,
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
              defense: s.defense === true,
              ownGoal: s.defense === true && s.ownGoal === true,
            })),
          ),
        ]
      : []),
    ...(mat
      ? [
          ...(mat.rounds.length ? [executor.insert(gameRounds).values(mat.rounds)] : []),
          ...(mat.roundTeams.length ? [executor.insert(gameRoundTeams).values(mat.roundTeams)] : []),
          ...(mat.throws.length ? [executor.insert(gameThrows).values(mat.throws)] : []),
          ...(mat.moves.length ? [executor.insert(capMoves).values(mat.moves)] : []),
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

/** Flattens a MatGameLog into rows with pre-generated ids (so the whole game
 * still goes out as one atomic batch). Rejects players that aren't in the game. */
function matRows(log: MatGameLog, teamIds: string[], gtp: Map<string, string>, gameId: string) {
  const player = (id: string) => {
    const v = gtp.get(id);
    if (!v) throw new Error("Mat log references a player who isn't in this game");
    return v;
  };
  const team = (i: number | null) => (i === null ? null : (teamIds[i] ?? null));
  const rounds: (typeof gameRounds.$inferInsert)[] = [];
  const roundTeams: (typeof gameRoundTeams.$inferInsert)[] = [];
  const throws: (typeof gameThrows.$inferInsert)[] = [];
  const moves: (typeof capMoves.$inferInsert)[] = [];
  for (const r of log.rounds) {
    const roundId = randomUUID();
    rounds.push({ id: roundId, gameId, number: r.number, complete: r.complete });
    r.teams.forEach((x, i) => teamIds[i] && roundTeams.push({ roundId, gameTeamId: teamIds[i], sips: x.sips, mama: x.mama }));
    for (const t of r.throws) {
      const throwId = randomUUID();
      throws.push({ id: throwId, roundId, seq: t.seq, gameTeamPlayerId: player(t.playerId), slot: t.slot, kind: t.kind, skipReason: t.skipReason, capNo: t.capNo });
      for (const m of t.moves) {
        moves.push({
          throwId, capNo: m.capNo, capOwnerId: player(m.ownerId), isThrownCap: m.isThrownCap,
          fromX: Math.round(m.fromX), fromY: Math.round(m.fromY), fromSpot: m.fromSpot,
          toX: Math.round(m.toX), toY: Math.round(m.toY), toSpot: m.toSpot, toCountsFor: team(m.toCountsForTeam),
        });
      }
    }
  }
  return { rounds, roundTeams, throws, moves };
}

export type RematchSource = {
  groupId: string | null;
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
    createdBy: game.createdBy,
    teams: game.teams.map((t) => ({
      label: t.teamLabel,
      players: t.players.map((p) => ({ id: p.userId, name: p.user.name ?? "Player" })),
    })),
  };
}
