"use server";

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
