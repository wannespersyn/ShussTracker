/**
 * POST /api/v1/games/[gameId]/reactions
 *
 * `{ reaction: "fire" | "laugh" | "beer" | "skull" }` toggles the viewer's
 * reaction (a push goes out when one is added). Returns the new tallies.
 */
import { after } from "next/server";
import { api, oneOf, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { REACTIONS, getGameActivity, toggleReaction } from "@/lib/db/activity";
import { requireGameAccess } from "@/lib/services/games";
import { notifyReaction } from "@/lib/notify";

type Ctx = { params: Promise<{ gameId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { gameId } = await params;
  await requireGameAccess(gameId, userId);
  const reaction = oneOf(await readJson(req), "reaction", REACTIONS);
  const added = await toggleReaction(gameId, userId, reaction);
  if (added) after(() => notifyReaction(gameId, userId, reaction).catch(() => {}));
  const { reactions } = await getGameActivity(gameId, userId);
  return { added, reactions };
});
