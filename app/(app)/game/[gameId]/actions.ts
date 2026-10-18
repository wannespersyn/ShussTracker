"use server";

import { BLOB_ACCESS } from "@/lib/photo";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyComment, notifyReaction } from "@/lib/notify";
import { revalidatePath } from "next/cache";
import { invalidateCrew } from "@/lib/cache-tags";
import { canDeleteGame } from "@/lib/db/game-permissions";
import { db } from "@/lib/db";
import { games, tournamentMatches } from "@/lib/db/schema";
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

/** Deletes a game for good (teams, players, shots, comments and reactions
 * cascade), removes its photo from Blob and refreshes the crew's stats.
 * Allowed for whoever logged it, the crew owner and app admins; tournament
 * games are refused because the bracket depends on them. */
export async function deleteGameAction(gameId: string) {
  const userId = await requireUserId();
  const game = await requireGameAccess(gameId, userId);
  if (!(await canDeleteGame(game, userId))) throw new Error("Not allowed");
  const inTournament = await db.query.tournamentMatches.findFirst({ where: eq(tournamentMatches.gameId, gameId), columns: { id: true } });
  if (inTournament) throw new Error("This game is part of a tournament");

  await db.delete(games).where(eq(games.id, gameId));
  if (game.photoUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del(game.photoUrl).catch(() => {});
  }
  invalidateCrew(game.groupId);
  redirect(game.groupId ? `/crews/${game.groupId}/feed` : "/home");
}
