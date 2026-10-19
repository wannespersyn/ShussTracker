/**
 * /api/v1/me
 *
 * GET    → the signed-in user and their crews.
 * PATCH  → `{ name }` changes the display name.
 * DELETE → `{ confirm: "DELETE" }` deletes the account (anonymised, crew
 *          stats stay — see lib/db/account.ts). Required by the App Store.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deleteAccount } from "@/lib/db/account";
import { expireAllCrews } from "@/lib/cache-tags";
import { api, badRequest, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { getMe } from "@/lib/api/me";

export const GET = api(async (req) => getMe(await requireApiUser(req)));

export const PATCH = api(async (req) => {
  const userId = await requireApiUser(req);
  const name = str(await readJson(req), "name", 60);
  await db.update(users).set({ name }).where(eq(users.id, userId));
  expireAllCrews();
  return getMe(userId);
});

export const DELETE = api(async (req) => {
  const userId = await requireApiUser(req);
  const body = await readJson(req);
  if (body.confirm !== "DELETE") throw badRequest('Send { "confirm": "DELETE" } to delete the account');
  await deleteAccount(userId);
  expireAllCrews();
});
