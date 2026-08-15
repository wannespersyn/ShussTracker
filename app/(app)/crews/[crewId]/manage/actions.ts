"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId, requireGroupOwner } from "@/lib/db/authz";
import { renameCrew, regenerateInviteCode, removeCrewMember, deleteCrew } from "@/lib/db/crews";

export async function renameCrewAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your crew a name");

  await renameCrew(groupId, name);
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
  revalidatePath(`/crews/${groupId}/manage`);
  revalidatePath(`/crews/${groupId}`);
}

export async function deleteCrewAction(groupId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await deleteCrew(groupId);
  redirect("/crews");
}
