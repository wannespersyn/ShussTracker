/**
 * Tournament match action
 *
 * Stores a played tournament match as a normal game (so it counts for Elo
 * and stats, incl. kruip) and advances the bracket.
 */
"use server";

import { after } from "next/server";
import { notifyGameLogged } from "@/lib/notify";
import { invalidateCrew } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournamentMatches } from "@/lib/db/schema";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type ShotInput } from "@/lib/db/games";
import { recordMatchResult } from "@/lib/db/tournaments";

export type PlayTournamentMatchInput = {
  matchId: string;
  teamA: { entrantId: string; playerIds: [string, string] };
  teamB: { entrantId: string; playerIds: [string, string] };
  winnerEntrantId: string;
  shotsByPlayer: ShotInput[];
  /** Entrant id of the losing team when it had to kruip. */
  kruipEntrantId?: string | null;
};

export async function playTournamentMatch(input: PlayTournamentMatchInput) {
  const userId = await requireUserId();

  const match = await db.query.tournamentMatches.findFirst({
    where: eq(tournamentMatches.id, input.matchId),
    with: { tournament: true },
  });
  if (!match) throw new Error("Match not found");
  if (match.gameId) throw new Error("This match has already been played");

  await requireGroupMember(userId, match.tournament.groupId);

  const { gameId } = await createGameRecord({
    groupId: match.tournament.groupId,
    createdBy: userId,
    matType: "4",
    teams: [
      {
        label: "A",
        playerIds: input.teamA.playerIds,
        finalRank: input.winnerEntrantId === input.teamA.entrantId ? 1 : 2,
        kruip: input.kruipEntrantId === input.teamA.entrantId,
      },
      {
        label: "B",
        playerIds: input.teamB.playerIds,
        finalRank: input.winnerEntrantId === input.teamB.entrantId ? 1 : 2,
        kruip: input.kruipEntrantId === input.teamB.entrantId,
      },
    ],
    shotsByPlayer: input.shotsByPlayer,
  });

  await recordMatchResult(input.matchId, gameId, input.winnerEntrantId);

  invalidateCrew(match.tournament.groupId);
  after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  redirect(`/tournaments/${match.tournamentId}`);
}
