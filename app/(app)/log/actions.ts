"use server";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type FieldHit } from "@/lib/db/games";

export type LogGameInput = {
  groupId: string;
  eventId?: string;
  matType: "2" | "4" | "8";
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: { playerId: string; fieldHit: FieldHit }[];
};

export async function logGame(input: LogGameInput) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);

  const { gameId } = await createGameRecord({ ...input, createdBy: userId });

  redirect(`/game/${gameId}`);
}
