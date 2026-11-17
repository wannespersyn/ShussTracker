"use server";

import { invalidateCrew } from "@/lib/cache-tags";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId, requireGroupOwner } from "@/lib/db/authz";
import { renameCrew, regenerateInviteCode, removeCrewMember, deleteCrew, setCrewRules } from "@/lib/db/crews";
import type { Ruleset } from "@/lib/rules";

export async function renameCrewAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your crew a name");

  await renameCrew(groupId, name);
  invalidateCrew(groupId);
  revalidatePath(`/crews/${groupId}`);
  revalidatePath(`/crews/${groupId}/manage`);
}

export async function regenerateInviteCodeAction(groupId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await regenerateInviteCode(groupId);
  revalidatePath(`/crews/${groupId}`);
  revalidatePath(`/crews/${groupId}/manage`);
}

export async function removeCrewMemberAction(groupId: string, memberUserId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await removeCrewMember(groupId, memberUserId);
  invalidateCrew(groupId);
  revalidatePath(`/crews/${groupId}/manage`);
  revalidatePath(`/crews/${groupId}`);
}

export async function deleteCrewAction(groupId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await deleteCrew(groupId);
  invalidateCrew(groupId);
  redirect("/crews");
}

/** Game, theme and house rules. Owner only; invalid values fall back to the game's defaults. */
export async function setCrewRulesAction(groupId: string, rules: Ruleset) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await setCrewRules(groupId, rules);
  invalidateCrew(groupId);
  revalidatePath("/", "layout");
}
