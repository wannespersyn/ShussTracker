/**
 * POST /api/v1/auth/dev — local development only
 *
 * `{ email }` signs the app in as an existing user without Google/Apple, so
 * the Expo app can be tried in Expo Go against `next dev`. Exists only when
 * NODE_ENV is "development" AND DEV_APP_LOGIN=1; everywhere else (every
 * Vercel deployment runs with NODE_ENV=production) it answers 404.
 */
import { eq } from "drizzle-orm";
import { api, notFound, readJson, str } from "@/lib/api/http";
import { createAppSession } from "@/lib/api/session";
import { getMe } from "@/lib/api/me";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const POST = api(async (req) => {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_APP_LOGIN !== "1") throw notFound();
  const email = str(await readJson(req), "email", 200).toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) throw notFound();
  const session = await createAppSession(user.id);
  return { ...session, created: false, ...(await getMe(user.id)) };
});
