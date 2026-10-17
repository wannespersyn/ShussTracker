"use server";

import { BLOB_ACCESS } from "@/lib/photo";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { requireUserId, requireGroupMember } from "@/lib/db/authz";
import { addComment, deleteComment, getComment, toggleReaction, type Reaction } from "@/lib/db/activity";

async function requireGameAccess(gameId: string, userId: string) {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game) throw new Error("Game not found");
  if (game.groupId) {
    await requireGroupMember(userId, game.groupId);
  } else if (game.createdBy !== userId) {
    throw new Error("Not allowed");
  }
  return game;
}

export async function addCommentAction(gameId: string, formData: FormData) {
  const userId = await requireUserId();
  await requireGameAccess(gameId, userId);

  const text = String(formData.get("text") ?? "").trim().slice(0, 500);
  if (!text) return;

  await addComment(gameId, userId, text);
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

  await toggleReaction(gameId, userId, reaction);
  revalidatePath(`/game/${gameId}`);
}

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Stores a (client-side downscaled) photo of the mat in Vercel Blob and
 * links it to the game. Needs BLOB_READ_WRITE_TOKEN (Vercel → Storage →
 * Blob → connect to project). */
export async function uploadGamePhotoAction(gameId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  await requireGameAccess(gameId, userId);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No photo" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Not an image" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "Photo too large" };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Photo storage isn't set up yet" };

  const { put } = await import("@vercel/blob");
  const blob = await put(`games/${gameId}/${Date.now()}.jpg`, file, { access: BLOB_ACCESS, contentType: file.type });
  await db.update(games).set({ photoUrl: blob.url }).where(eq(games.id, gameId));
  revalidatePath(`/game/${gameId}`);
  return { ok: true };
}
