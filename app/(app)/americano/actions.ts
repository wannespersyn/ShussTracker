/**
 * Americano / Mexicano actions
 *
 * Create a rotation tournament, log one of its games (a normal game record
 * linked back to the slot), change it mid-night (mats, rounds, line-up,
 * standings order) and end it early. Rules live in lib/services/rotations.ts
 * (shared with the app API); these add the session and the redirects.
 */
"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import type { RotationUpdate } from "@/lib/db/rotations";
import type { RotationMode } from "@/lib/rotation";
import { createRotationAs, finishRotationAs, playRotationGameAs, updateRotationAs, type PlayRotationGameInput } from "@/lib/services/rotations";

export type { PlayRotationGameInput };

export async function createRotationAction(input: {
  groupId: string;
  name: string;
  mode: RotationMode;
  playerIds: string[];
  mats: number;
  rounds: number;
}) {
  const userId = await requireUserId();
  const id = await createRotationAs(userId, input);
  redirect(`/americano/${id}`);
}

export async function playRotationGameAction(input: PlayRotationGameInput) {
  const userId = await requireUserId();
  const { rotationId } = await playRotationGameAs(userId, input);
  redirect(`/americano/${rotationId}`);
}

export async function finishRotationAction(rotationId: string) {
  const userId = await requireUserId();
  await finishRotationAs(userId, rotationId);
  redirect(`/americano/${rotationId}`);
}

export async function updateRotationAction(rotationId: string, update: RotationUpdate) {
  const userId = await requireUserId();
  await updateRotationAs(userId, rotationId, update);
  redirect(`/americano/${rotationId}`);
}
