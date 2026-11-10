/**
 * POST /api/v1/tournaments/[tournamentId]/matches/[matchId]
 *
 * Plays a match: `{ winnerEntrantId, shotsByPlayer? }`. The teams come from
 * the bracket itself (not the request), the game is logged like any other
 * 4-mat game and the winner moves on. Returns `{ gameId }`.
 */
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { ApiError, api, badRequest, notFound, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { tournamentMatches } from "@/lib/db/schema";
import { requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type FieldHit } from "@/lib/db/games";
import { recordMatchResult } from "@/lib/db/tournaments";
import { expireCrew } from "@/lib/cache-tags";
import { notifyGameLogged } from "@/lib/notify";

type Ctx = { params: Promise<{ tournamentId: string; matchId: string }> };
const HITS: FieldHit[] = ["1", "2", "3", "mama", "miss"];

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { tournamentId, matchId } = await params;
  const match = await db.query.tournamentMatches.findFirst({
    where: eq(tournamentMatches.id, matchId),
    with: { tournament: true, entrantA: true, entrantB: true },
  });
  if (!match || match.tournamentId !== tournamentId) throw notFound();
  await requireGroupMember(userId, match.tournament.groupId).catch(() => {
    throw notFound();
  });
  if (match.gameId) throw new ApiError(409, "already_played", "This match has already been played");
  if (!match.entrantA || !match.entrantB) throw new ApiError(409, "not_ready", "This match is still waiting for its teams");

  const body = await readJson(req);
  const winner = body.winnerEntrantId;
  if (winner !== match.entrantA.id && winner !== match.entrantB.id) throw badRequest('"winnerEntrantId" must be one of the two teams');

  const a = [match.entrantA.player1Id, match.entrantA.player2Id];
  const b = [match.entrantB.player1Id, match.entrantB.player2Id];
  const inGame = new Set([...a, ...b]);
  const raw = Array.isArray(body.shotsByPlayer) ? body.shotsByPlayer : [];
  if (raw.length > 400) throw badRequest("Too many shots");
  const shotsByPlayer = raw.map((s) => {
    const shot = s as { playerId?: unknown; fieldHit?: unknown };
    if (typeof shot.playerId !== "string" || !inGame.has(shot.playerId)) throw badRequest("Shots must belong to players in this match");
    if (typeof shot.fieldHit !== "string" || !HITS.includes(shot.fieldHit as FieldHit)) throw badRequest('"fieldHit" must be 1, 2, 3, mama or miss');
    return { playerId: shot.playerId, fieldHit: shot.fieldHit as FieldHit };
  });

  const { gameId } = await createGameRecord({
    groupId: match.tournament.groupId,
    createdBy: userId,
    matType: "4",
    teams: [
      { label: "A", playerIds: a, finalRank: winner === match.entrantA.id ? 1 : 2 },
      { label: "B", playerIds: b, finalRank: winner === match.entrantB.id ? 1 : 2 },
    ],
    shotsByPlayer,
  });
  await recordMatchResult(matchId, gameId, winner);
  expireCrew(match.tournament.groupId);
  after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  return Response.json({ gameId }, { status: 201 });
});
