"use server";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createTournament } from "@/lib/db/tournaments";

export type CreateTournamentInput = {
  groupId: string;
  eventId?: string;
  name: string;
  entrantPairs: [string, string][];
};

export async function createTournamentAction(input: CreateTournamentInput) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);

  const tournamentId = await createTournament(input.groupId, userId, input.name, input.eventId, input.entrantPairs);
  redirect(`/tournaments/${tournamentId}`);
}
