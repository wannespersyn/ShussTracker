/**
 * POST /api/v1/games/[gameId]/comments
 *
 * `{ text }` (max 500 chars) adds a comment ("trash talk") and pushes it to
 * the game's players. Returns the game's updated comment list.
 */
import { after } from "next/server";
import { api, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { addComment, getGameActivity } from "@/lib/db/activity";
import { requireGameAccess } from "@/lib/services/games";
import { notifyComment } from "@/lib/notify";

type Ctx = { params: Promise<{ gameId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  await requireGameAccess(gameId, userId);
  const text = str(await readJson(req), "text", 500);
  await addComment(gameId, userId, text);
  after(() => notifyComment(gameId, userId, text).catch(() => {}));
  const { comments } = await getGameActivity(gameId, userId);
  return Response.json({ comments }, { status: 201 });
});
