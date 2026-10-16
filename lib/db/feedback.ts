import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedback, feedbackVotes } from "@/lib/db/schema";

export type FeedbackType = "bug" | "idea" | "other";
export type FeedbackStatus = "new" | "under_review" | "planned" | "in_progress" | "done" | "declined";

export async function submitFeedback(input: { userId: string; groupId?: string | null; type: FeedbackType; text: string }) {
  const [row] = await db
    .insert(feedback)
    .values({ userId: input.userId, groupId: input.groupId ?? null, type: input.type, text: input.text })
    .returning();
  if (input.type === "idea") await db.insert(feedbackVotes).values({ feedbackId: row.id, userId: input.userId });
  return row.id;
}

export type IdeaRow = { id: string; text: string; status: FeedbackStatus; votes: number; votedByMe: boolean; mine: boolean };

/** Public ideas board, most-voted first (declined/done hidden). */
export async function getIdeas(viewerId: string): Promise<IdeaRow[]> {
  const rows = await db.query.feedback.findMany({
    where: and(eq(feedback.type, "idea"), inArray(feedback.status, ["new", "under_review", "planned", "in_progress"])),
    with: { votes: true },
    orderBy: desc(feedback.createdAt),
  });
  return rows
    .map((r) => ({
      id: r.id,
      text: r.text,
      status: r.status,
      votes: r.votes.length,
      votedByMe: r.votes.some((v) => v.userId === viewerId),
      mine: r.userId === viewerId,
    }))
    .sort((a, b) => b.votes - a.votes);
}

export async function toggleVote(feedbackId: string, userId: string) {
  const existing = await db.query.feedbackVotes.findFirst({
    where: and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)),
  });
  if (existing) {
    await db.delete(feedbackVotes).where(and(eq(feedbackVotes.feedbackId, feedbackId), eq(feedbackVotes.userId, userId)));
  } else {
    await db.insert(feedbackVotes).values({ feedbackId, userId });
  }
}

/** Admin inbox: everything, newest first. */
export async function getAllFeedback() {
  return db.query.feedback.findMany({ with: { votes: true, user: true, group: true }, orderBy: desc(feedback.createdAt) });
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  await db.update(feedback).set({ status }).where(eq(feedback.id, id));
}
