/**
 * Log-game input validation
 *
 * Parses and checks a "log a game" request from an untrusted client (the
 * mobile app): mat type, team count and size, unique players who are all
 * members of the crew, finishing ranks 1..n, and shots only for players in
 * the game. Returns a CreateGameInput ready for createGameRecord.
 *
 * Exports: parseLogGameInput
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import type { CreateGameInput, FieldHit } from "@/lib/db/games";
import { badRequest } from "@/lib/api/http";

const MATS = { "2": { teams: 2, size: 1 }, "4": { teams: 2, size: 2 }, "8": { teams: 4, size: 2 } } as const;
const HITS: FieldHit[] = ["1", "2", "3", "mama", "miss"];
const MAX_SHOTS = 400;

export async function parseLogGameInput(body: Record<string, unknown>, createdBy: string): Promise<CreateGameInput> {
  const { groupId, matType, teams, shotsByPlayer = [] } = body as {
    groupId?: unknown;
    matType?: unknown;
    teams?: unknown;
    shotsByPlayer?: unknown;
  };
  if (typeof groupId !== "string") throw badRequest('"groupId" is required');
  if (typeof matType !== "string" || !(matType in MATS)) throw badRequest('"matType" must be "2", "4" or "8"');
  const mat = MATS[matType as keyof typeof MATS];

  if (!Array.isArray(teams) || teams.length !== mat.teams) throw badRequest(`${matType}-player mats need exactly ${mat.teams} teams`);
  const parsedTeams = teams.map((t, i) => {
    const team = t as { label?: unknown; playerIds?: unknown; finalRank?: unknown };
    if (!Array.isArray(team.playerIds) || team.playerIds.length !== mat.size || !team.playerIds.every((p) => typeof p === "string")) {
      throw badRequest(`Team ${i + 1} needs exactly ${mat.size} player id(s)`);
    }
    if (!Number.isInteger(team.finalRank) || (team.finalRank as number) < 1 || (team.finalRank as number) > mat.teams) {
      throw badRequest(`Team ${i + 1} needs a finalRank between 1 and ${mat.teams}`);
    }
    const label = typeof team.label === "string" && team.label.trim() ? team.label.trim().slice(0, 30) : String.fromCharCode(65 + i);
    return { label, playerIds: team.playerIds as string[], finalRank: team.finalRank as number };
  });

  if (new Set(parsedTeams.map((t) => t.finalRank)).size !== parsedTeams.length) throw badRequest("Each team needs a different finalRank");
  const playerIds = parsedTeams.flatMap((t) => t.playerIds);
  if (new Set(playerIds).size !== playerIds.length) throw badRequest("A player can only be in one team");

  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, playerIds)));
  if (members.length !== playerIds.length) throw badRequest("Every player must be a member of the crew");

  if (!Array.isArray(shotsByPlayer) || shotsByPlayer.length > MAX_SHOTS) throw badRequest('"shotsByPlayer" must be a list');
  const inGame = new Set(playerIds);
  const shots = shotsByPlayer.map((s) => {
    const shot = s as { playerId?: unknown; fieldHit?: unknown };
    if (typeof shot.playerId !== "string" || !inGame.has(shot.playerId)) throw badRequest("Shots must belong to players in this game");
    if (typeof shot.fieldHit !== "string" || !HITS.includes(shot.fieldHit as FieldHit)) throw badRequest('"fieldHit" must be 1, 2, 3, mama or miss');
    return { playerId: shot.playerId, fieldHit: shot.fieldHit as FieldHit };
  });

  return { groupId, createdBy, matType: matType as CreateGameInput["matType"], teams: parsedTeams, shotsByPlayer: shots };
}
