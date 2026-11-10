/**
 * Game services
 *
 * Game rules shared by the web server actions and the /api/v1 handlers:
 * who may see a game, deleting a game, and storing a mat photo.
 *
 * Exports: requireGameAccess, deleteGameAs, storeGamePhoto, MAX_PHOTO_BYTES
 * Data: Neon via Drizzle, photos in Vercel Blob (needs BLOB_READ_WRITE_TOKEN).
 * Notes: callers handle cache invalidation and redirects themselves.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, tournamentMatches } from "@/lib/db/schema";
import { ForbiddenError, requireGroupMember } from "@/lib/db/authz";
import { canDeleteGame } from "@/lib/db/game-permissions";
import { BLOB_ACCESS } from "@/lib/photo";
import { getT } from "@/lib/i18n/server";
import { ApiError } from "@/lib/api/http";

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** A 404 for the API wrapper; a plain thrown error for server actions. */
export class GameNotFoundError extends ApiError {
  constructor() {
    super(404, "not_found", "Game not found");
    this.name = "GameNotFoundError";
  }
}

/** The game, if the user may see it: a member of its crew, or whoever
 * logged a crew-less game. Throws GameNotFoundError / ForbiddenError. */
export async function requireGameAccess(gameId: string, userId: string) {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game) throw new GameNotFoundError();
  if (game.groupId) {
    await requireGroupMember(userId, game.groupId);
  } else if (game.createdBy !== userId) {
    throw new ForbiddenError();
  }
  return game;
}

/** Deletes a game for good (teams, shots, comments and reactions cascade)
 * and removes its photo. Allowed for whoever logged it, the crew owner and
 * app admins; tournament games are refused because the bracket depends on
 * them. Returns the game's crew id for cache invalidation. */
export async function deleteGameAs(gameId: string, userId: string): Promise<{ groupId: string | null }> {
  const game = await requireGameAccess(gameId, userId);
  if (!(await canDeleteGame(game, userId))) throw new ForbiddenError();
  const inTournament = await db.query.tournamentMatches.findFirst({ where: eq(tournamentMatches.gameId, gameId), columns: { id: true } });
  if (inTournament) throw new ForbiddenError("This game is part of a tournament");

  await db.delete(games).where(eq(games.id, gameId));
  if (game.photoUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del(game.photoUrl).catch(() => {});
  }
  return { groupId: game.groupId };
}

/** Validates and stores a (client-side downscaled) mat photo and links it
 * to the game. Returns a translated error message instead of throwing for
 * problems with the file itself. */
export async function storeGamePhoto(gameId: string, userId: string, file: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireGameAccess(gameId, userId);
  const { errors: e } = await getT();
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: e.noPhoto };
  if (!file.type.startsWith("image/")) return { ok: false, error: e.notImage };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: e.tooLarge };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: e.noStorage };

  const { put } = await import("@vercel/blob");
  const blob = await put(`games/${gameId}/${Date.now()}.jpg`, file, { access: BLOB_ACCESS, contentType: file.type });
  await db.update(games).set({ photoUrl: blob.url }).where(eq(games.id, gameId));
  return { ok: true };
}
