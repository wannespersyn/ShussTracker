/**
 * Server actions for Settings › Beta: join/leave, per-feature switches and
 * beta feedback (quick thumbs or the full sheet).
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/db/authz";
import { getUserCrews } from "@/lib/db/crew-insights";
import { setBetaFeature, setBetaOptIn, submitBetaFeedback } from "@/lib/db/beta";
import { BETA_GENERAL, BETA_LEAVE_REASONS, BETA_TAGS, isBetaKey } from "@/lib/beta";

function refresh() {
  revalidatePath("/", "layout");
}

async function firstCrewId(userId: string) {
  return (await getUserCrews(userId))[0]?.id ?? null;
}

export async function joinBetaAction() {
  const userId = await requireUserId();
  await setBetaOptIn(userId, true);
  refresh();
  redirect("/settings/beta");
}

export async function toggleBetaFeatureAction(formData: FormData) {
  const userId = await requireUserId();
  const key = formData.get("key");
  if (!isBetaKey(key)) return;
  await setBetaFeature(userId, key, formData.get("on") === "1");
  refresh();
}

/** Thumbs up/down on an explainer page: stored as rating 4 / 1. */
export async function quickRateAction(formData: FormData) {
  const userId = await requireUserId();
  const key = formData.get("key");
  if (!isBetaKey(key)) return;
  const up = formData.get("vote") === "up";
  await submitBetaFeedback({ userId, groupId: await firstCrewId(userId), feature: key, rating: up ? 4 : 1, text: up ? "(thumbs up)" : "(thumbs down)" });
  redirect(`/settings/beta/${key}?rated=${up ? "up" : "down"}`);
}

export async function betaFeedbackAction(formData: FormData) {
  const userId = await requireUserId();
  const raw = formData.get("feature");
  const feature = isBetaKey(raw) ? raw : BETA_GENERAL;
  const ratingNum = Number(formData.get("rating"));
  const rating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 4 ? ratingNum : null;
  const tags = formData.getAll("tag").map(String).filter((t): t is (typeof BETA_TAGS)[number] => (BETA_TAGS as readonly string[]).includes(t));
  const note = String(formData.get("text") ?? "").trim().slice(0, 1000);
  if (rating === null && tags.length === 0 && note.length === 0) return;
  const text = [tags.length ? `[${tags.join(", ")}]` : "", note].filter(Boolean).join(" ") || "(score)";
  await submitBetaFeedback({ userId, groupId: await firstCrewId(userId), feature, rating, text });
  revalidatePath("/admin");
  redirect(`/settings/beta/feedback?feature=${feature}&sent=1`);
}

export async function leaveBetaAction(formData: FormData) {
  const userId = await requireUserId();
  const reason = String(formData.get("reason") ?? "");
  await setBetaOptIn(userId, false);
  if ((BETA_LEAVE_REASONS as readonly string[]).includes(reason)) {
    await submitBetaFeedback({ userId, groupId: await firstCrewId(userId), feature: BETA_GENERAL, rating: null, text: `left: ${reason}` });
  }
  refresh();
  redirect("/settings/beta/stop?done=1");
}

export async function rejoinBetaAction() {
  const userId = await requireUserId();
  await setBetaOptIn(userId, true);
  refresh();
  redirect("/settings/beta");
}
