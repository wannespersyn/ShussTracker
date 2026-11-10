/**
 * Stats layout — data access
 *
 * Loads and saves a player's own stats page layout (screens of blocks).
 * Whatever is stored goes through sanitizeLayout on the way in and out.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { statsLayouts } from "@/lib/db/schema";
import { sanitizeLayout, type StatsLayout } from "@/lib/stats-layout";

export async function getStatsLayout(userId: string): Promise<StatsLayout | null> {
  const row = await db.query.statsLayouts.findFirst({ where: eq(statsLayouts.userId, userId) });
  return row ? sanitizeLayout(row.layout) : null;
}

export async function saveStatsLayout(userId: string, input: unknown): Promise<boolean> {
  const layout = sanitizeLayout(input);
  if (!layout) return false;
  await db
    .insert(statsLayouts)
    .values({ userId, layout, updatedAt: new Date() })
    .onConflictDoUpdate({ target: statsLayouts.userId, set: { layout, updatedAt: new Date() } });
  return true;
}
