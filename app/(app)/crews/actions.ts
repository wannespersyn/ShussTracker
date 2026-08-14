"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { createCrewForUser, joinCrewByCode } from "@/lib/db/crews";

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
