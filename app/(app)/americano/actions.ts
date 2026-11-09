/**
 * Americano / Mexicano actions
 *
 * Create a rotation tournament, log one of its games (a normal game record
 * linked back to the slot), and end it early. All scoped to crew members.
 */
"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, groupMembers, groups } from "@/lib/db/schema";
import { requireGroupMember, requireUserId } from "@/lib/db/authz";
import { createGameRecord, type GameTeamInput, type ShotInput } from "@/lib/db/games";
import { createRotation, finishRotation, getRotation, getRotationGame, recordRotationGame } from "@/lib/db/rotations";
import { hasBeta } from "@/lib/db/beta";
import { invalidateCrew } from "@/lib/cache-tags";
import { notifyGameLogged } from "@/lib/notify";
import type { MatGameLog } from "@/lib/mat";
import type { RotationMode } from "@/lib/rotation";

export async function createRotationAction(input: {
  groupId: string;
  name: string;
  mode: RotationMode;
  playerIds: string[];
  mats: number;
  rounds: number;
}) {
  const userId = await requireUserId();
  await requireGroupMember(userId, input.groupId);
  // Only crew members (guests included) can be in the line-up.
  const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, input.groupId), columns: { userId: true } });
  const allowed = new Set(members.map((m) => m.userId));
  if (!input.playerIds.every((id) => allowed.has(id))) throw new Error("Everyone has to be in the crew");
  const id = await createRotation({ ...input, name: input.name.trim().slice(0, 60) || "Americano", createdBy: userId });
  redirect(`/americano/${id}`);
}

export type PlayRotationGameInput = {
  rotationGameId: string;
  teams: GameTeamInput[];
  shotsByPlayer: ShotInput[];
  mat?: MatGameLog;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export async function playRotationGameAction(input: PlayRotationGameInput) {
  const userId = await requireUserId();
  const slot = await getRotationGame(input.rotationGameId);
  if (!slot) throw new Error("Game not found");
  const rotation = await getRotation(slot.rotationId);
  if (!rotation) throw new Error("Tournament not found");
  await requireGroupMember(userId, rotation.groupId);
  if (slot.gameId) redirect(`/americano/${rotation.id}`);

  // The logged teams must be exactly the planned duos.
  const a = [slot.a1, slot.a2];
  const b = [slot.b1, slot.b2];
  const ok =
    input.teams.length === 2 &&
    input.teams.some((t) => sameSet(t.playerIds, a)) &&
    input.teams.some((t) => sameSet(t.playerIds, b));
  if (!ok) throw new Error("Teams don't match this game");

  const mat = input.mat && (await hasBeta(userId, "mat")) ? input.mat : undefined;
  const { gameId } = await createGameRecord({
    groupId: rotation.groupId,
    createdBy: userId,
    matType: "4",
    teams: input.teams,
    shotsByPlayer: input.shotsByPlayer,
    mat,
  });

  const linked = await recordRotationGame(slot.id, gameId);
  if (!linked) {
    // Someone else logged this slot a moment earlier: drop the duplicate.
    await db.delete(games).where(eq(games.id, gameId));
  } else {
    after(() => notifyGameLogged(gameId, userId).catch(() => {}));
  }
  invalidateCrew(rotation.groupId);
  redirect(`/americano/${rotation.id}`);
}

/** Only whoever started it or the crew owner can end it early. */
export async function finishRotationAction(rotationId: string) {
  const userId = await requireUserId();
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error("Tournament not found");
  await requireGroupMember(userId, rotation.groupId);
  const crew = await db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { createdBy: true } });
  if (rotation.createdBy !== userId && crew?.createdBy !== userId) throw new Error("Not allowed");
  await finishRotation(rotationId);
  invalidateCrew(rotation.groupId);
  redirect(`/americano/${rotationId}`);
}
