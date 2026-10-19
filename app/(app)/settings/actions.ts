"use server";

import { invalidateAllCrews } from "@/lib/cache-tags";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/db/authz";

export async function updateDisplayName(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Enter a display name");

  await db.update(users).set({ name }).where(eq(users.id, userId));
  invalidateAllCrews();
  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath(`/players/${userId}`);
}
