/**
 * Log-game input validation
 *
 * Parses and checks a "log a game" request from an untrusted client (the
 * mobile app): mat type, team count and size, unique players who are all
 * members of the crew, finishing ranks 1..n, shots only for players in
 * the game, kruip for losing teams and the beta mat log. Returns a
 * CreateGameInput ready for createGameRecord.
 *
 * Exports: parseLogGameInput, parseTeamsAndShots, parseMatLog
 * Notes: the mat log is only kept for users with the "mat" beta on.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import type { CreateGameInput, FieldHit, GameTeamInput, ShotInput } from "@/lib/db/games";
import type { MatGameLog } from "@/lib/mat";
import { hasBeta } from "@/lib/db/beta";
import { badRequest } from "@/lib/api/http";

const MATS = { "2": { teams: 2, size: 1 }, "4": { teams: 2, size: 2 }, "8": { teams: 4, size: 2 } } as const;
const HITS: FieldHit[] = ["1", "2", "3", "mama", "mama_out", "miss"];
const MAX_SHOTS = 400;

export async function parseLogGameInput(body: Record<string, unknown>, createdBy: string): Promise<CreateGameInput> {
  const { groupId, matType } = body as { groupId?: unknown; matType?: unknown };
  if (typeof groupId !== "string") throw badRequest('"groupId" is required');
  if (typeof matType !== "string" || !(matType in MATS)) throw badRequest('"matType" must be "2", "4" or "8"');
  const { teams, shots } = parseTeamsAndShots(body, matType as keyof typeof MATS);

  const playerIds = teams.flatMap((t) => t.playerIds);
  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, playerIds)));
  if (members.length !== playerIds.length) throw badRequest("Every player must be a member of the crew");

  const mat = matType !== "8" && body.mat !== undefined && (await hasBeta(createdBy, "mat")) ? parseMatLog(body.mat, playerIds) : undefined;
  return { groupId, createdBy, matType: matType as CreateGameInput["matType"], teams, shotsByPlayer: shots, mat };
}

/** Teams (with kruip) and shots of a log request, checked against the mat type. */
export function parseTeamsAndShots(body: Record<string, unknown>, matType: keyof typeof MATS): { teams: GameTeamInput[]; shots: ShotInput[] } {
  const { teams, shotsByPlayer = [] } = body as { teams?: unknown; shotsByPlayer?: unknown };
  const mat = MATS[matType];
  if (!Array.isArray(teams) || teams.length !== mat.teams) throw badRequest(`${matType}-player mats need exactly ${mat.teams} teams`);
  const parsedTeams = teams.map((t, i) => {
    const team = t as { label?: unknown; playerIds?: unknown; finalRank?: unknown; kruip?: unknown };
    if (!Array.isArray(team.playerIds) || team.playerIds.length !== mat.size || !team.playerIds.every((p) => typeof p === "string")) {
      throw badRequest(`Team ${i + 1} needs exactly ${mat.size} player id(s)`);
    }
    if (!Number.isInteger(team.finalRank) || (team.finalRank as number) < 1 || (team.finalRank as number) > mat.teams) {
      throw badRequest(`Team ${i + 1} needs a finalRank between 1 and ${mat.teams}`);
    }
    const label = typeof team.label === "string" && team.label.trim() ? team.label.trim().slice(0, 30) : String.fromCharCode(65 + i);
    return { label, playerIds: team.playerIds as string[], finalRank: team.finalRank as number, kruip: team.kruip === true && team.finalRank !== 1 };
  });

  if (new Set(parsedTeams.map((t) => t.finalRank)).size !== parsedTeams.length) throw badRequest("Each team needs a different finalRank");
  const playerIds = parsedTeams.flatMap((t) => t.playerIds);
  if (new Set(playerIds).size !== playerIds.length) throw badRequest("A player can only be in one team");

  if (!Array.isArray(shotsByPlayer) || shotsByPlayer.length > MAX_SHOTS) throw badRequest('"shotsByPlayer" must be a list');
  const inGame = new Set(playerIds);
  const shots = shotsByPlayer.map((s) => {
    const shot = s as { playerId?: unknown; fieldHit?: unknown; defense?: unknown; ownGoal?: unknown };
    if (typeof shot.playerId !== "string" || !inGame.has(shot.playerId)) throw badRequest("Shots must belong to players in this game");
    if (typeof shot.fieldHit !== "string" || !HITS.includes(shot.fieldHit as FieldHit)) throw badRequest('"fieldHit" must be 1, 2, 3, mama, mama_out or miss');
    return { playerId: shot.playerId, fieldHit: shot.fieldHit as FieldHit, defense: shot.defense === true, ownGoal: shot.defense === true && shot.ownGoal === true };
  });
  return { teams: parsedTeams, shots };
}

const SLOTS = ["a1", "a2", "b1", "b2"];
const CORNERS = ["TL", "TR", "BL", "BR"];
const THROW_KINDS = ["normal", "bonus", "skipped"];
const int = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const spot = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 12;

/** Shape check of a beta mat log (every round, throw and cap move). Player
 * ids must be in the game; anything malformed is a 400. */
export function parseMatLog(raw: unknown, playerIds: string[]): MatGameLog {
  const bad = (what: string) => badRequest(`Invalid mat log: ${what}`);
  const log = raw as Partial<MatGameLog> | null;
  if (!log || typeof log !== "object") throw bad("not an object");
  if (!CORNERS.includes(log.a1Corner as string)) throw bad("a1Corner");
  if (log.endedBy !== "pints_empty") throw bad("endedBy");
  if (!int(log.winnerTeam, 0, 1)) throw bad("winnerTeam");
  if (!Array.isArray(log.rounds) || log.rounds.length > 200) throw bad("rounds");
  const ids = new Set(playerIds);
  let moves = 0;
  for (const r of log.rounds) {
    if (!int(r?.number, 1, 500) || typeof r.complete !== "boolean" || typeof r.allDrink !== "boolean") throw bad("round");
    if (r.jokerTeam !== null && !int(r.jokerTeam, 0, 1)) throw bad("jokerTeam");
    if (!Array.isArray(r.teams) || r.teams.length > 2 || !r.teams.every((x) => int(x?.sips, 0, 999) && typeof x.mama === "boolean")) throw bad("round teams");
    if (!Array.isArray(r.throws) || r.throws.length > 60) throw bad("throws");
    for (const t of r.throws) {
      if (!int(t?.seq, 1, 999) || !ids.has(t.playerId) || !SLOTS.includes(t.slot) || !THROW_KINDS.includes(t.kind)) throw bad("throw");
      if (t.skipReason !== null && typeof t.skipReason !== "string") throw bad("skipReason");
      if (t.capNo !== null && !int(t.capNo, 0, 99)) throw bad("capNo");
      if (!Array.isArray(t.moves)) throw bad("moves");
      moves += t.moves.length;
      for (const m of t.moves) {
        if (!int(m?.capNo, 0, 99) || !ids.has(m.ownerId) || typeof m.isThrownCap !== "boolean" || !spot(m.fromSpot) || !spot(m.toSpot)) throw bad("move");
        if (m.toCountsForTeam !== null && !int(m.toCountsForTeam, 0, 1)) throw bad("move team");
      }
    }
  }
  if (moves > 5000) throw bad("too many moves");
  return log as MatGameLog;
}
