"use server";

import { redirect } from "next/navigation";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { createCrewForUser, joinCrewByCode, removeCrewMember } from "@/lib/db/crews";
import { createEvent } from "@/lib/db/events";

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createCrew(formData: FormData) {
  const userId = await requireUserId();
  const name = stringField(formData, "name").trim();
  if (!name) throw new Error("Give your crew a name");

  const groupId = await createCrewForUser(userId, name);
  redirect(`/crews/${groupId}`);
}

export type JoinCrewState = { error?: string };

export async function joinCrew(_prev: JoinCrewState, formData: FormData): Promise<JoinCrewState> {
  const userId = await requireUserId();
  const result = await joinCrewByCode(userId, stringField(formData, "code"));
  if (result.error) return { error: result.error };

  redirect(`/crews/${result.groupId}`);
}

/** The crew owner can't leave their own crew here — they'd need to delete
 * it (from Manage crew) or hand it off, which this app doesn't support
 * yet. The crew page only shows "Leave" to non-owners. */
export async function leaveCrew(groupId: string) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);
  await removeCrewMember(groupId, userId);
  redirect("/crews");
}

export async function createEventAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);

  const name = stringField(formData, "name").trim() || "Game night";
  const date = stringField(formData, "date").trim() || new Date().toISOString().slice(0, 10);

  const eventId = await createEvent(groupId, userId, name, date);
  redirect(`/events/${eventId}`);
}
