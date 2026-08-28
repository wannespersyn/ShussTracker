"use server";

import { revalidatePath } from "next/cache";
import { requireUserId, requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { addGuestPlayer, removeGuestPlayer } from "@/lib/db/guests";

export async function addGuestAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give your guest a name");

  await addGuestPlayer(groupId, name);
  revalidatePath(`/crews/${groupId}`);
}

export async function removeGuestAction(groupId: string, guestId: string) {
  const userId = await requireUserId();
  await requireGroupOwner(userId, groupId);

  await removeGuestPlayer(guestId);
  revalidatePath(`/crews/${groupId}`);
}
