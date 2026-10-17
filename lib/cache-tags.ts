import { updateTag } from "next/cache";

/* Cross-request cache tags for crew data (lib/db/crew-insights.ts).
 * Server actions that change games, members or names call these so the
 * next render reads fresh data ("read your own writes"). */

export const ALL_CREWS_TAG = "crew-data";
export const crewTag = (groupId: string) => `crew:${groupId}`;

/** One crew's games/members changed. */
export function invalidateCrew(groupId: string | null | undefined) {
  if (groupId) updateTag(crewTag(groupId));
}

/** Something that shows up in every crew changed (a user's name, a guest
 * claim merging two users). */
export function invalidateAllCrews() {
  updateTag(ALL_CREWS_TAG);
}
