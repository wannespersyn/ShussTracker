/**
 * Log game action
 *
 * Server action behind the log wizard: checks crew membership, stores the
 * game (mat log only for beta users) and notifies the crew.
 */
"use server";

import { after } from "next/server";
import { notifyGameLogged } from "@/lib/notify";
import { invalidateCrew } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type GameTeamInput, type ShotInput } from "@/lib/db/games";
import type { MatGameLog } from "@/lib/mat";
import { hasBeta } from "@/lib/db/beta";

export type LogGameInput = {
  groupId: string;
  matType: "2" | "4" | "8";
  teams: GameTeamInput[];
  shotsByPlayer: ShotInput[];
  mat?: MatGameLog;
};

export async function logGame(input: LogGameInput) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);

  // The detailed mat log is a beta feature: only stored for users who have it on.
  const mat = input.mat && (await hasBeta(userId, "mat")) ? input.mat : undefined;
  const { gameId } = await createGameRecord({ ...input, mat, createdBy: userId });

  invalidateCrew(input.groupId);
  after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  redirect(`/game/${gameId}`);
}
