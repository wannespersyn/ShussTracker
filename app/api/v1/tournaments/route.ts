/**
 * POST /api/v1/tournaments
 *
 * `{ groupId, name, format: "single_elim" | "double_elim" | "round_robin",
 * entrantPairs: [[playerId, playerId], …] }` creates a tournament with its
 * full match schedule. Every player must be in the crew and appear once;
 * double elimination needs 4, 8, 16… duos. Returns `{ tournamentId }`.
 */
import { and, eq, inArray } from "drizzle-orm";
import { api, badRequest, oneOf, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireGroupMember } from "@/lib/db/authz";
import { createTournament, type TournamentFormat } from "@/lib/db/tournaments";

const FORMATS: TournamentFormat[] = ["single_elim", "double_elim", "round_robin"];

export const POST = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  const groupId = str(body, "groupId", 60);
  await requireGroupMember(userId, groupId);
  const name = str(body, "name", 60);
  const format = oneOf(body, "format", FORMATS);

  const pairs = body.entrantPairs;
  if (!Array.isArray(pairs) || pairs.length < 2 || pairs.length > 32) throw badRequest("A tournament needs 2 to 32 duos");
  if (!pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "string"))) {
    throw badRequest('"entrantPairs" must be pairs of player ids');
  }
  const ids = (pairs as [string, string][]).flat();
  if (new Set(ids).size !== ids.length) throw badRequest("A player can only be in one duo");
  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, ids)));
  if (members.length !== ids.length) throw badRequest("Every player must be a member of the crew");
  if (format === "double_elim" && (pairs.length < 4 || (pairs.length & (pairs.length - 1)) !== 0)) throw badRequest("Double elimination needs 4, 8, 16… duos");

  const tournamentId = await createTournament(groupId, userId, name, pairs as [string, string][], format);
  return Response.json({ tournamentId }, { status: 201 });
});
