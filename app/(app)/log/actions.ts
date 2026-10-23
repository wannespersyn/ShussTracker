"use server";

import { after } from "next/server";
import { notifyGameLogged } from "@/lib/notify";
import { invalidateCrew } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type ShotInput } from "@/lib/db/games";

export type LogGameInput = {
  groupId: string;
  matType: "2" | "4" | "8";
  teams: { label: string; playerIds: string[]; finalRank: number }[];
  shotsByPlayer: ShotInput[];
};

export async function logGame(input: LogGameInput) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);

  const { gameId } = await createGameRecord({ ...input, createdBy: userId });

  invalidateCrew(input.groupId);
  after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  redirect(`/game/${gameId}`);
}
