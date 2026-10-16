import { cache } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, groupMembers, groups } from "@/lib/db/schema";
import { buildCrewInsights, type CrewInsights, type InsightGame, type InsightPlayerRef } from "@/lib/insights";

/** Loads a crew's full history and runs it through buildCrewInsights.
 * Wrapped in React `cache` so several components on one page share a
 * single query + replay. */
export const getCrewInsights = cache(async (groupId: string): Promise<CrewInsights> => {
  const [members, rows] = await Promise.all([
    db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId), with: { user: true } }),
    db.query.games.findMany({
      where: eq(games.groupId, groupId),
      with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
    }),
  ]);

  const memberRefs: InsightPlayerRef[] = members.map((m) => ({
    id: m.userId,
    name: m.user.name ?? "Player",
    isGuest: m.user.isGuest,
  }));

  const insightGames: InsightGame[] = rows.map((g) => ({
    id: g.id,
    playedAt: g.playedAt,
    matType: g.matType,
    teams: g.teams.map((t) => ({
      rank: t.finalRank,
      players: t.players.map((p) => ({
        id: p.userId,
        name: p.user.name ?? "Player",
        isGuest: p.user.isGuest,
        mama: p.shots.filter((s) => s.fieldHit === "mama").length,
        shots: p.shots.length,
      })),
    })),
  }));

  return buildCrewInsights(memberRefs, insightGames);
});

export type UserCrew = { id: string; name: string; members: number; games: number; lastPlayedAt: Date | null; createdBy: string };

/** The viewer's crews, most active first (most recent game, then size). */
export const getUserCrews = cache(async (userId: string): Promise<UserCrew[]> => {
  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: { with: { members: true } } },
  });

  const crews = await Promise.all(
    memberships.map(async (m) => {
      const recent = await db.query.games.findMany({
        where: eq(games.groupId, m.groupId),
        orderBy: desc(games.playedAt),
        columns: { playedAt: true },
      });
      return {
        id: m.groupId,
        name: m.group.name,
        members: m.group.members.length,
        games: recent.length,
        lastPlayedAt: recent[0]?.playedAt ?? null,
        createdBy: m.group.createdBy,
      };
    }),
  );

  return crews.sort(
    (a, b) => (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0) || b.members - a.members,
  );
});

export async function getCrew(groupId: string) {
  return db.query.groups.findFirst({ where: eq(groups.id, groupId) });
}
