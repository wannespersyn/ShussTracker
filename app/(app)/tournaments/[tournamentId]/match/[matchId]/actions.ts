"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournamentMatches } from "@/lib/db/schema";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type FieldHit } from "@/lib/db/games";
import { recordMatchResult } from "@/lib/db/tournaments";

export type PlayTournamentMatchInput = {
  matchId: string;
  teamA: { entrantId: string; playerIds: [string, string] };
  teamB: { entrantId: string; playerIds: [string, string] };
  winnerEntrantId: string;
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
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
    eventId: match.tournament.eventId ?? undefined,
    createdBy: userId,
    matType: "4",
    teams: [
      {
        label: "A",
        playerIds: input.teamA.playerIds,
        finalRank: input.winnerEntrantId === input.teamA.entrantId ? 1 : 2,
      },
      {
        label: "B",
        playerIds: input.teamB.playerIds,
        finalRank: input.winnerEntrantId === input.teamB.entrantId ? 1 : 2,
      },
    ],
    shotsByPlayer: input.shotsByPlayer,
  });

  await recordMatchResult(input.matchId, gameId, input.winnerEntrantId);

  redirect(`/tournaments/${match.tournamentId}`);
}
