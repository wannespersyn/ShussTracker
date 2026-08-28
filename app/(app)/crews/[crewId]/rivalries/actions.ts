"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId, requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { createRivalry, deleteRivalry, getRivalryOwner, rivalryAlreadyExists, type RivalrySide } from "@/lib/db/rivalries";

function stringField(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function pinRivalryAction(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGroupMember(userId, groupId);

  const aPlayer1Id = stringField(formData, "aPlayer1");
  const aPlayer2Id = stringField(formData, "aPlayer2");
  const bPlayer1Id = stringField(formData, "bPlayer1");
  const bPlayer2Id = stringField(formData, "bPlayer2");
  if (!aPlayer1Id || !bPlayer1Id) throw new Error("Pick both sides of the beef");
  if ((aPlayer2Id === null) !== (bPlayer2Id === null)) {
    throw new Error("Both sides need to be the same size — solo vs solo, or duo vs duo");
  }

  const a: RivalrySide = { player1Id: aPlayer1Id, player2Id: aPlayer2Id };
  const b: RivalrySide = { player1Id: bPlayer1Id, player2Id: bPlayer2Id };

  const aIds = new Set([a.player1Id, ...(a.player2Id ? [a.player2Id] : [])]);
  if ([b.player1Id, ...(b.player2Id ? [b.player2Id] : [])].some((id) => aIds.has(id))) {
    throw new Error("The two sides can't share a player");
  }

  if (await rivalryAlreadyExists(groupId, a, b)) throw new Error("That beef is already pinned");

  await createRivalry(groupId, userId, a, b);
  revalidatePath(`/crews/${groupId}`);
  redirect(`/crews/${groupId}`);
}

export async function unpinRivalryAction(rivalryId: string) {
  const userId = await requireUserId();
  const owner = await getRivalryOwner(rivalryId);
  if (!owner) return;
  if (owner.createdBy !== userId) {
    await requireGroupOwner(userId, owner.groupId);
  }
  await deleteRivalry(rivalryId);
  revalidatePath(`/crews/${owner.groupId}`);
}
