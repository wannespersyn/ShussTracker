/**
 * DELETE /api/v1/games/[gameId]/comments/[commentId]
 *
 * Deletes a comment — only its own author may (same rule as the website).
 */
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { deleteComment, getComment } from "@/lib/db/activity";

type Ctx = { params: Promise<{ gameId: string; commentId: string }> };

export const DELETE = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId, commentId } = await params;
  const comment = await getComment(commentId);
  if (!comment || comment.gameId !== gameId || comment.userId !== userId) throw notFound();
  await deleteComment(commentId);
});
