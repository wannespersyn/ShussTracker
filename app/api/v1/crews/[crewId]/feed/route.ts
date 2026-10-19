/**
 * GET /api/v1/crews/[crewId]/feed?limit=25
 *
 * The crew's recent games, newest first, with comment counts and reaction
 * tallies. `photoPath` is relative to the API host (private photos go
 * through /api/game-photo, which accepts the bearer token). Members only.
 */
import { api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getCrewActivityFeed } from "@/lib/db/activity";
import { photoSrc } from "@/lib/photo";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25));
  const feed = await getCrewActivityFeed(crewId, userId, limit);
  return {
    games: feed.map(({ photoUrl, ...g }) => ({ ...g, photoPath: photoUrl ? photoSrc(g.id, photoUrl) : null })),
  };
});
