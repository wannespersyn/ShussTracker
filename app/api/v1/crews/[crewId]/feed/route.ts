/**
 * GET /api/v1/crews/[crewId]/feed?limit=25
 *
 * The crew's recent games, newest first, with comment counts and reaction
 * tallies, plus the crew records set in that window (newest first, with
 * names). `photoPath` is relative to the API host (private photos go
 * through /api/game-photo, which accepts the bearer token). Members only.
 */
import { api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getCrewActivityFeed } from "@/lib/db/activity";
import { photoSrc } from "@/lib/photo";
import { getCrewHistory } from "@/lib/db/crew-insights";
import { crewRecords } from "@/lib/records";
import { firstName } from "@/lib/insights";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25));
  const [feed, history] = await Promise.all([getCrewActivityFeed(crewId, userId, limit), getCrewHistory(crewId)]);
  const oldest = feed.at(-1)?.playedAt.getTime() ?? Infinity;
  const person = new Map(history.members.map((m) => [m.id, firstName(m.name)]));
  for (const g of history.games) for (const tm of g.teams) for (const p of tm.players) if (!person.has(p.id)) person.set(p.id, firstName(p.name));
  const records = crewRecords(history.games)
    .filter((r) => r.at.getTime() >= oldest)
    .map((r) => ({ ...r, name: person.get(r.userId) ?? null, previousName: r.previousHolder ? (person.get(r.previousHolder) ?? null) : null }));
  return {
    games: feed.map(({ photoUrl, ...g }) => ({ ...g, photoPath: photoUrl ? photoSrc(g.id, photoUrl) : null })),
    records,
  };
});
