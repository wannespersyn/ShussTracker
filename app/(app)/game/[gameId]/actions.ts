"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyComment, notifyReaction } from "@/lib/notify";
import { revalidatePath } from "next/cache";
import { invalidateCrew } from "@/lib/cache-tags";
import { requireUserId } from "@/lib/db/authz";
import { addComment, deleteComment, getComment, toggleReaction, type Reaction } from "@/lib/db/activity";
import { deleteGameAs, requireGameAccess, storeGamePhoto } from "@/lib/services/games";

export async function addCommentAction(gameId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGameAccess(gameId, userId);

  const text = String(formData.get("text") ?? "").trim().slice(0, 500);
  if (!text) return;

  await addComment(gameId, userId, text);
  after(() => notifyComment(gameId, userId, text).catch(() => {}));
  revalidatePath(`/game/${gameId}`);
}

/** Only the comment's own author can delete it — no crew-owner override,
 * unlike crew management actions, since trash talk is low-stakes and
 * "someone else's mod deleted my comment" is worse than leaving it up. */
export async function deleteCommentAction(gameId: string, commentId: string) {
  const userId = await requireUserId();
  const comment = await getComment(commentId);
  if (!comment || comment.gameId !== gameId || comment.userId !== userId) return;

  await deleteComment(commentId);
  revalidatePath(`/game/${gameId}`);
}

export async function toggleReactionAction(gameId: string, reaction: Reaction) {
  const userId = await requireUserId();
  await requireGameAccess(gameId, userId);

  const added = await toggleReaction(gameId, userId, reaction);
  if (added) after(() => notifyReaction(gameId, userId, reaction).catch(() => {}));
  revalidatePath(`/game/${gameId}`);
}

/** Stores a (client-side downscaled) photo of the mat in Vercel Blob and
 * links it to the game. Needs BLOB_READ_WRITE_TOKEN (Vercel → Storage →
 * Blob → connect to project). */
export async function uploadGamePhotoAction(gameId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const res = await storeGamePhoto(gameId, userId, formData.get("photo"));
  if (res.ok) revalidatePath(`/game/${gameId}`);
  return res;
}

/** Deletes a game for good and refreshes the crew's stats — rules live in
 * lib/services/games.ts. */
export async function deleteGameAction(gameId: string) {
  const userId = await requireUserId();
  const { groupId } = await deleteGameAs(gameId, userId);
  invalidateCrew(groupId);
  redirect(groupId ? `/crews/${groupId}/feed` : "/home");
}
