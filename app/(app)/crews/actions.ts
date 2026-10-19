"use server";

import { invalidateCrew } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createCrewForUser, joinCrewByCode, removeCrewMember } from "@/lib/db/crews";

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createCrew(formData: FormData) {
  const userId = await requireUserId();
  const name = stringField(formData, "name").trim();
  if (!name) throw new Error("Give your crew a name");

  const groupId = await createCrewForUser(userId, name);
  invalidateCrew(groupId);
  redirect(`/crews/${groupId}`);
}

export type JoinCrewState = { error?: string };

export async function joinCrew(_prev: JoinCrewState, formData: FormData): Promise<JoinCrewState> {
  const userId = await requireUserId();
  const result = await joinCrewByCode(userId, stringField(formData, "code"));
  if (result.error) return { error: result.error };

  invalidateCrew(result.groupId);
  redirect(`/crews/${result.groupId}`);
}

/** The crew owner can't leave their own crew here — they'd need to delete
 * it (from Manage crew) or hand it off, which this app doesn't support
 * yet. The crew page only shows "Leave" to non-owners. */
export async function leaveCrew(groupId: string) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);
  await removeCrewMember(groupId, userId);
  invalidateCrew(groupId);
  redirect("/crews");
}

