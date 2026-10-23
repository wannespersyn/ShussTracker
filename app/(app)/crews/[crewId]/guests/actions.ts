"use server";

import { invalidateCrew } from "@/lib/cache-tags";

import { revalidatePath } from "next/cache";
import { requireUserId, requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { addGuestPlayer, removeGuestPlayer } from "@/lib/db/guests";

export async function addGuestAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your guest a name");

  await addGuestPlayer(groupId, name);
  invalidateCrew(groupId);
  revalidatePath(`/crews/${groupId}`);
}

/** Popup variant: returns the new guest's claim code so the dialog can
 * offer the claim link right away. */
export async function createGuestAction(
  groupId: string,
  rawName: string,
): Promise<{ ok: true; name: string; claimToken: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);

  const name = rawName.trim().slice(0, 40);
  if (!name) return { ok: false, error: "Give your guest a name" };

  const { claimToken } = await addGuestPlayer(groupId, name);
  invalidateCrew(groupId);
  revalidatePath(`/crews/${groupId}`);
  revalidatePath(`/crews/${groupId}/manage`);
  return { ok: true, name, claimToken };
}

export async function removeGuestAction(groupId: string, guestId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await removeGuestPlayer(guestId);
  invalidateCrew(groupId);
  revalidatePath(`/crews/${groupId}`);
}
