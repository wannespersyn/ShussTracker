/**
 * POST /api/v1/games/[gameId]/photo
 *
 * multipart/form-data with a `photo` image (max 4 MB — downscale on the
 * device first). Replaces the game's mat photo; returns `{ photoPath }`.
 * Viewing goes through GET /api/game-photo/[gameId] with the bearer token.
 */
import { eq } from "drizzle-orm";
import { ApiError, api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { storeGamePhoto } from "@/lib/services/games";
import { photoSrc } from "@/lib/photo";

type Ctx = { params: Promise<{ gameId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "bad_request", "Expected multipart/form-data");
  const res = await storeGamePhoto(gameId, userId, form.get("photo"));
  if (!res.ok) throw new ApiError(400, "invalid_photo", res.error);
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId), columns: { photoUrl: true } });
  return { photoPath: game?.photoUrl ? photoSrc(gameId, game.photoUrl) : null };
});
