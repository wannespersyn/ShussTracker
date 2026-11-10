/**
 * Rotation tournament services
 *
 * The Americano / Mexicano rules shared by the web server actions and the
 * /api/v1 handlers: who may create, log, change or end a rotation, and
 * that a logged game matches the planned duos.
 *
 * Exports: createRotationAs, playRotationGameAs, finishRotationAs,
 *          updateRotationAs, requireRotationMember, PlayRotationGameInput
 * Data: Neon via Drizzle (lib/db/rotations.ts), games via createGameRecord.
 * Notes: callers handle redirects; crew caches are invalidated here.
 */
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, groupMembers, groups } from "@/lib/db/schema";
import { ForbiddenError, requireGroupMember } from "@/lib/db/authz";
import { createGameRecord, type GameTeamInput, type ShotInput } from "@/lib/db/games";
import { createRotation, finishRotation, getRotation, getRotationGame, recordRotationGame, updateRotation, type RotationUpdate } from "@/lib/db/rotations";
import { hasBeta } from "@/lib/db/beta";
import { invalidateCrew } from "@/lib/cache-tags";
import { notifyGameLogged } from "@/lib/notify";
import type { MatGameLog } from "@/lib/mat";
import type { RotationMode } from "@/lib/rotation";

async function crewMemberIds(groupId: string) {
  const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId), columns: { userId: true } });
  return new Set(members.map((m) => m.userId));
}

/** The rotation, if the user is in its crew. Throws when it doesn't exist. */
export async function requireRotationMember(rotationId: string, userId: string) {
  const rotation = await getRotation(rotationId);
  if (!rotation) throw new Error("Tournament not found");
  await requireGroupMember(userId, rotation.groupId);
  return rotation;
}

/** Whoever started it, or the crew owner. */
async function requireOrganizer(rotationId: string, userId: string) {
  const rotation = await requireRotationMember(rotationId, userId);
  const crew = await db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { createdBy: true } });
  if (rotation.createdBy !== userId && crew?.createdBy !== userId) throw new ForbiddenError();
  return rotation;
}

export async function createRotationAs(
  userId: string,
  input: { groupId: string; name: string; mode: RotationMode; playerIds: string[]; mats: number; rounds: number },
): Promise<string> {
  await requireGroupMember(userId, input.groupId);
  // Only crew members (guests included) can be in the line-up.
  const allowed = await crewMemberIds(input.groupId);
  if (!input.playerIds.every((id) => allowed.has(id))) throw new Error("Everyone has to be in the crew");
  const id = await createRotation({ ...input, name: input.name.trim().slice(0, 60) || "Americano", createdBy: userId });
  invalidateCrew(input.groupId);
  return id;
}

export type PlayRotationGameInput = {
  rotationGameId: string;
  teams: GameTeamInput[];
  shotsByPlayer: ShotInput[];
  mat?: MatGameLog;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Logs one planned game of a rotation as a normal game and links it to the
 * slot. Returns the rotation id and the game id (null when someone else
 * logged the slot first). */
export async function playRotationGameAs(userId: string, input: PlayRotationGameInput): Promise<{ rotationId: string; gameId: string | null }> {
  const slot = await getRotationGame(input.rotationGameId);
  if (!slot) throw new Error("Game not found");
  const rotation = await requireRotationMember(slot.rotationId, userId);
  if (slot.gameId) return { rotationId: rotation.id, gameId: null };

  // The logged teams must be exactly the planned duos.
  const a = [slot.a1, slot.a2];
  const b = [slot.b1, slot.b2];
  const ok = input.teams.length === 2 && input.teams.some((t) => sameSet(t.playerIds, a)) && input.teams.some((t) => sameSet(t.playerIds, b));
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
  return { rotationId: rotation.id, gameId: linked ? gameId : null };
}

/** Only whoever started it or the crew owner can end it early. */
export async function finishRotationAs(userId: string, rotationId: string) {
  const rotation = await requireOrganizer(rotationId, userId);
  await finishRotation(rotationId);
  invalidateCrew(rotation.groupId);
}

/** Organizer changes mats, rounds, line-up or standings order mid-night.
 * New players must be in the crew. */
export async function updateRotationAs(userId: string, rotationId: string, update: RotationUpdate) {
  const rotation = await requireOrganizer(rotationId, userId);
  if (update.addIds.length) {
    const allowed = await crewMemberIds(rotation.groupId);
    if (!update.addIds.every((id) => allowed.has(id))) throw new Error("Everyone has to be in the crew");
  }
  await updateRotation(rotationId, update);
  invalidateCrew(rotation.groupId);
}
