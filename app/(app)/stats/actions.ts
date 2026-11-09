/**
 * Stats page actions
 *
 * Saves the signed-in player's stats layout (screens and blocks). The input
 * is untrusted JSON from the editor; it's validated before it's stored.
 */
"use server";

import { requireUserId } from "@/lib/db/authz";
import { saveStatsLayout } from "@/lib/db/stats-layout";

export async function saveStatsLayoutAction(layout: unknown): Promise<boolean> {
  const userId = await requireUserId();
  return saveStatsLayout(userId, layout);
}
