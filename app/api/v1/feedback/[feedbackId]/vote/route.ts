/**
 * POST /api/v1/feedback/[feedbackId]/vote
 *
 * Toggles the viewer's vote on an idea. Returns the refreshed ideas board.
 */
import { eq } from "drizzle-orm";
import { api, notFound } from "@/lib/api/http";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/api/session";
import { getIdeas, toggleVote } from "@/lib/db/feedback";

type Ctx = { params: Promise<{ feedbackId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { feedbackId } = await params;
  const idea = await db.query.feedback.findFirst({ where: eq(feedback.id, feedbackId), columns: { type: true } });
  if (idea?.type !== "idea") throw notFound();
  await toggleVote(feedbackId, userId);
  return { ideas: await getIdeas(userId) };
});
