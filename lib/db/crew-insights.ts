import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { ALL_CREWS_TAG, crewTag } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { games, groupMembers, groups } from "@/lib/db/schema";
import { buildCrewInsights, type CrewInsights, type InsightGame, type InsightPlayerRef } from "@/lib/insights";

/** Loads a crew's full history and runs it through buildCrewInsights.
 * Wrapped in React `cache` so several components on one page share a
 * single query + replay. */
/** Writes from this app invalidate the cache instantly; this is only the
 * safety net for writes it can't see (e.g. the old app sharing the same
 * database during the beta). Raise it once every write goes through v2. */
const CREW_CACHE_SECONDS = Number(process.env.CREW_CACHE_SECONDS ?? 300);

type CachedCrewData = {
  members: InsightPlayerRef[];
  games: (Omit<InsightGame, "playedAt"> & { playedAt: number })[];
};

/** The raw crew history, cached across requests (tagged per crew) and
 * invalidated by the server actions that change it — see lib/cache-tags.ts.
 * Stored with plain-number dates so it survives the cache's JSON round trip. */
function loadCrewData(groupId: string): Promise<CachedCrewData> {
  return unstable_cache(
    async (): Promise<CachedCrewData> => {
      const [members, rows] = await Promise.all([
        db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId), with: { user: true } }),
        db.query.games.findMany({
          where: eq(games.groupId, groupId),
          columns: { id: true, playedAt: true, matType: true },
          with: {
            teams: {
              columns: { finalRank: true },
              with: {
                players: {
                  columns: { userId: true },
                  with: { user: { columns: { name: true, isGuest: true } }, shots: { columns: { fieldHit: true } } },
                },
              },
            },
          },
        }),
      ]);
      return {
        members: members.map((m) => ({ id: m.userId, name: m.user.name ?? "Player", isGuest: m.user.isGuest })),
        games: rows.map((g) => ({
          id: g.id,
          playedAt: g.playedAt.getTime(),
          matType: g.matType,
          teams: g.teams.map((t) => ({
            rank: t.finalRank,
            players: t.players.map((p) => ({
              id: p.userId,
              name: p.user.name ?? "Player",
              isGuest: p.user.isGuest,
              mama: p.shots.filter((x) => x.fieldHit === "mama").length,
              shots: p.shots.length,
            })),
          })),
        })),
      };
    },
    ["crew-data-v1", groupId],
    { tags: [crewTag(groupId), ALL_CREWS_TAG], revalidate: CREW_CACHE_SECONDS },
  )();
}

/** Insights are recomputed per request from the cached history (cheap, and
 * keeps "this week" relative to now), memoised within the request. */
export const getCrewInsights = cache(async (groupId: string): Promise<CrewInsights> => {
  const data = await loadCrewData(groupId);
  return buildCrewInsights(
    data.members,
    data.games.map((g) => ({ ...g, playedAt: new Date(g.playedAt) })),
  );
});

export type UserCrew = { id: string; name: string; members: number; games: number; lastPlayedAt: Date | null; createdBy: string };

/** The viewer's crews, most active first (most recent game, then size). */
export const getUserCrews = cache(async (userId: string): Promise<UserCrew[]> => {
  const res = await db.execute(sql`
    select g.id, g.name, g.created_by as "createdBy",
      (select count(*) from "group_member" m2 where m2.group_id = g.id)::int as members,
      (select count(*) from "game" x where x.group_id = g.id)::int as games,
      (select max(played_at) from "game" x where x.group_id = g.id) as "lastPlayedAt"
    from "group_member" m join "group" g on g.id = m.group_id
    where m.user_id = ${userId}
  `);
  const crews = (res.rows as { id: string; name: string; createdBy: string; members: number; games: number; lastPlayedAt: string | Date | null }[]).map(
    (r) => ({ ...r, lastPlayedAt: r.lastPlayedAt ? new Date(r.lastPlayedAt) : null }),
  );
  return crews.sort(
    (a, b) => (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0) || b.members - a.members,
  );
});

export async function getCrew(groupId: string) {
  return db.query.groups.findFirst({ where: eq(groups.id, groupId) });
}
