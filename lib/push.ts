import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/* Web Push. Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT
 * (mailto:you@…); without them every send is a silent no-op. Generate the
 * keys once with `npx web-push generate-vapid-keys`. Each subscription
 * remembers its device's UI language, so pass a builder `(t) => payload`
 * to get every push written in the receiver's language. */

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export async function sendPush(userIds: string[], payload: PushPayload | ((t: Dictionary) => PushPayload)) {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || userIds.length === 0) return;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@shussapp.app", pub, priv);

  const subs = await db.query.pushSubscriptions.findMany({ where: inArray(pushSubscriptions.userId, [...new Set(userIds)]) });
  const dead: string[] = [];
  const bodies = new Map<Locale, string>();
  const bodyFor = (raw: string) => {
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    if (!bodies.has(locale)) bodies.set(locale, JSON.stringify(typeof payload === "function" ? payload(getDictionary(locale)) : payload));
    return bodies.get(locale)!;
  };
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, bodyFor(s.locale), { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string; locale: Locale }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth, locale: sub.locale } });
}

/** Follows a language switch in Settings to all of the user's devices. */
export async function setPushLocale(userId: string, locale: Locale) {
  await db.update(pushSubscriptions).set({ locale }).where(eq(pushSubscriptions.userId, userId));
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
