"use server";

import { requireUserId } from "@/lib/db/authz";
import { removePushSubscription, savePushSubscription, sendPush } from "@/lib/push";

export async function subscribePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const userId = await requireUserId();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await savePushSubscription(userId, { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  await sendPush([userId], { title: "Notifications on", body: "You’ll hear about comments, reactions and games you’re logged in.", url: "/settings" });
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string) {
  await requireUserId();
  await removePushSubscription(endpoint);
}
