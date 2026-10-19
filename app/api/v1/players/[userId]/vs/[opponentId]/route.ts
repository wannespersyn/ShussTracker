/**
 * GET /api/v1/players/[userId]/vs/[opponentId]
 *
 * Head-to-head between two players: wins each way and recent meetings,
 * plus both players' rows in a crew they share. The viewer must share a
 * crew with both players.
 */
import { inArray } from "drizzle-orm";
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSharesCrew } from "@/lib/db/authz";
import { getHeadToHead } from "@/lib/db/h2h";
import { getCrewInsights, getUserCrews } from "@/lib/db/crew-insights";

type Ctx = { params: Promise<{ userId: string; opponentId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const viewerId = await requireApiUser(req);
  const { userId: aId, opponentId: bId } = await params;
  const people = await db.query.users.findMany({ where: inArray(users.id, [aId, bId]), columns: { id: true, name: true, image: true } });
  if (aId === bId || people.length !== 2) throw notFound();
  await Promise.all([requireSharesCrew(viewerId, aId), requireSharesCrew(viewerId, bId)]).catch(() => {
    throw notFound();
  });

  const [h2h, aCrews, bCrews] = await Promise.all([getHeadToHead(aId, bId), getUserCrews(aId), getUserCrews(bId)]);
  const shared = aCrews.find((c) => bCrews.some((x) => x.id === c.id)) ?? null;
  const insights = shared ? await getCrewInsights(shared.id) : null;
  const row = (id: string) => insights?.players.find((p) => p.userId === id) ?? null;

  return {
    a: { ...people.find((p) => p.id === aId)!, stats: row(aId) },
    b: { ...people.find((p) => p.id === bId)!, stats: row(bId) },
    crew: shared ? { id: shared.id, name: shared.name } : null,
    ...h2h,
  };
});
