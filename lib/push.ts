/**
 * Push notifications
 *
 * Sends one notification to a set of users on every device they enabled:
 * browsers via Web Push (VAPID) and the mobile app via the Expo push
 * service. Each device remembers its UI language, so pass a builder
 * `(t) => payload` to have every push written in the receiver's language.
 *
 * Exports: sendPush, PushPayload, pushPublicKey, save/removePushSubscription,
 *          saveAppPushToken, removeAppPushToken, setPushLocale
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (web; without them
 *      web sends are skipped), EXPO_ACCESS_TOKEN (optional, for Expo's
 *      enhanced push security).
 * Notes: dead endpoints/tokens are pruned when a send reports them gone.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appPushTokens, pushSubscriptions } from "@/lib/db/schema";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
type PayloadInput = PushPayload | ((t: Dictionary) => PushPayload);

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

function payloadFor(input: PayloadInput) {
  const cache = new Map<Locale, PushPayload>();
  return (raw: string): PushPayload => {
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    if (!cache.has(locale)) cache.set(locale, typeof input === "function" ? input(getDictionary(locale)) : input);
    return cache.get(locale)!;
  };
}

export async function sendPush(userIds: string[], payload: PayloadInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const forLocale = payloadFor(payload);
  await Promise.all([sendWeb(ids, forLocale), sendExpo(ids, forLocale)]);
}

async function sendWeb(userIds: string[], forLocale: (locale: string) => PushPayload) {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  const subs = await db.query.pushSubscriptions.findMany({ where: inArray(pushSubscriptions.userId, userIds) });
  if (subs.length === 0) return;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@shussapp.app", pub, priv);

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(forLocale(s.locale)), { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendExpo(userIds: string[], forLocale: (locale: string) => PushPayload) {
  const tokens = await db.query.appPushTokens.findMany({ where: inArray(appPushTokens.userId, userIds) });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => {
    const p = forLocale(t.locale);
    return { to: t.token, title: p.title, body: p.body, data: { url: p.url }, sound: "default", ...(p.tag ? { threadId: p.tag } : {}) };
  });
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const dead: string[] = [];
  // Expo accepts at most 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(chunk) });
      const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
      json?.data?.forEach((ticket, k) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") dead.push(chunk[k].to);
      });
    } catch {
      /* network hiccup: skip, the next event tries again */
    }
  }
  if (dead.length) await db.delete(appPushTokens).where(inArray(appPushTokens.token, dead));
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string; locale: Locale }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth, locale: sub.locale } });
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Registers (or re-assigns) a device's Expo push token. */
export async function saveAppPushToken(userId: string, token: string, platform: "ios" | "android", locale: Locale) {
  await db
    .insert(appPushTokens)
    .values({ userId, token, platform, locale })
    .onConflictDoUpdate({ target: appPushTokens.token, set: { userId, platform, locale } });
}

/** Removes a device token — only the owner's own, so tokens can't be probed. */
export async function removeAppPushToken(userId: string, token: string) {
  const row = await db.query.appPushTokens.findFirst({ where: eq(appPushTokens.token, token), columns: { userId: true } });
  if (row?.userId === userId) await db.delete(appPushTokens).where(eq(appPushTokens.token, token));
}

/** Follows a language switch to all of the user's devices (web and app). */
export async function setPushLocale(userId: string, locale: Locale) {
  await Promise.all([
    db.update(pushSubscriptions).set({ locale }).where(eq(pushSubscriptions.userId, userId)),
    db.update(appPushTokens).set({ locale }).where(eq(appPushTokens.userId, userId)),
  ]);
}
