"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { submitFeedback, toggleVote, type FeedbackType } from "@/lib/db/feedback";

const TYPES: FeedbackType[] = ["bug", "idea", "other"];

export async function submitFeedbackAction(formData: FormData) {
  const userId = await requireUserId();
  const type = String(formData.get("type") ?? "idea") as FeedbackType;
  const text = String(formData.get("text") ?? "").trim().slice(0, 1000);
  if (!TYPES.includes(type) || text.length < 3) return;
  await submitFeedback({ userId, type, text, groupId: (formData.get("groupId") as string) || null });
  revalidatePath("/feedback");
  redirect("/feedback?sent=1");
}

export async function toggleVoteAction(feedbackId: string) {
  const userId = await requireUserId();
  await toggleVote(feedbackId, userId);
  revalidatePath("/feedback");
}
