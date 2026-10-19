import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { requireGroupMember } from "@/lib/db/authz";
import { optionalApiUser } from "@/lib/api/session";

/** Streams a game photo from the private Blob store — only to members of the
 * game's crew (or the person who logged a crew-less game). Accepts the web
 * session cookie or the app's bearer token. */
export async function GET(req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  const userId = (await optionalApiUser(req)) ?? (await auth())?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const game = await db.query.games.findFirst({ where: eq(games.id, gameId), columns: { groupId: true, createdBy: true, photoUrl: true } });
  if (!game?.photoUrl) return new Response("Not found", { status: 404 });
  try {
    if (game.groupId) await requireGroupMember(userId, game.groupId);
    else if (game.createdBy !== userId) throw new Error("forbidden");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const { get } = await import("@vercel/blob");
  const result = await get(game.photoUrl, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return new Response("Not found", { status: 404 });

  return new Response(result.stream, {
    headers: {
      "content-type": result.blob.contentType ?? "image/jpeg",
      // Each upload gets a new ?v=, so the browser may keep it for a long time.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
