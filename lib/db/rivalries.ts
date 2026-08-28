import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rivalries, gameTeamPlayers } from "@/lib/db/schema";
import { rivalryInsight, type RivalryInsight } from "@/lib/rivalry-insight";

export type RivalrySide = { player1Id: string; player2Id: string | null };

export async function createRivalry(
  groupId: string,
  createdBy: string,
  a: RivalrySide,
  b: RivalrySide,
): Promise<string> {
  const id = randomUUID();
  await db.insert(rivalries).values({
    id,
    groupId,
    createdBy,
    aPlayer1Id: a.player1Id,
    aPlayer2Id: a.player2Id,
    bPlayer1Id: b.player1Id,
    bPlayer2Id: b.player2Id,
  });
  return id;
}

export async function deleteRivalry(rivalryId: string) {
  await db.delete(rivalries).where(eq(rivalries.id, rivalryId));
}

export async function getRivalryOwner(rivalryId: string): Promise<{ groupId: string; createdBy: string } | null> {
  const row = await db.query.rivalries.findFirst({ where: eq(rivalries.id, rivalryId) });
  return row ? { groupId: row.groupId, createdBy: row.createdBy } : null;
}

type SideRecordMeeting = { gameId: string; playedAt: Date; aWon: boolean };
type SideRecord = { aWins: number; bWins: number; meetings: SideRecordMeeting[] };

/** Games where side A's exact player set was on one team and side B's
 * exact player set was on the opposing team — the "duo" generalization of
 * lib/db/h2h.ts's player-vs-player record. A team's player set always
 * matches a side's size exactly (mat structure fixes team size at 1 or 2),
 * so "contains everyone on this side" is enough to confirm a match. */
async function getSideVsSideRecord(aIds: string[], bIds: string[]): Promise<SideRecord> {
  const anchorId = aIds[0];
  const rows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, anchorId),
    with: { gameTeam: { with: { game: { with: { teams: { with: { players: true } } } } } } },
  });

  const aSet = new Set(aIds);
  const bSet = new Set(bIds);
  const matchesSide = (playerIds: string[], side: Set<string>) =>
    playerIds.length === side.size && playerIds.every((id) => side.has(id));

  const seenGameIds = new Set<string>();
  const meetings: SideRecordMeeting[] = [];
  let aWins = 0;
  let bWins = 0;

  for (const row of rows) {
    const game = row.gameTeam.game;
    if (seenGameIds.has(game.id)) continue;
    const teamA = game.teams.find((t) => matchesSide(t.players.map((p) => p.userId), aSet));
    const teamB = game.teams.find((t) => matchesSide(t.players.map((p) => p.userId), bSet));
    if (!teamA || !teamB) continue;

    seenGameIds.add(game.id);
    const aWon = (teamA.finalRank ?? 99) < (teamB.finalRank ?? 99);
    if (aWon) aWins++;
    else bWins++;
    meetings.push({ gameId: game.id, playedAt: game.playedAt, aWon });
  }

  meetings.sort((x, y) => y.playedAt.getTime() - x.playedAt.getTime());
  return { aWins, bWins, meetings };
}

export type RivalryCard = {
  id: string;
  createdBy: string;
  aLabel: string;
  bLabel: string;
  aWins: number;
  bWins: number;
  totalMeetings: number;
  insight: RivalryInsight | null;
};

/** Every beef pinned in a crew, with its running score computed live from
 * game history — nothing about the score is stored, only who's in the
 * beef. See getSideVsSideRecord. */
export async function getCrewRivalries(groupId: string): Promise<RivalryCard[]> {
  const rows = await db.query.rivalries.findMany({
    where: eq(rivalries.groupId, groupId),
    with: { aPlayer1: true, aPlayer2: true, bPlayer1: true, bPlayer2: true },
  });

  return Promise.all(
    rows.map(async (r) => {
      const aIds = [r.aPlayer1Id, ...(r.aPlayer2Id ? [r.aPlayer2Id] : [])];
      const bIds = [r.bPlayer1Id, ...(r.bPlayer2Id ? [r.bPlayer2Id] : [])];
      const record = await getSideVsSideRecord(aIds, bIds);

      const aLabel = [r.aPlayer1.name, r.aPlayer2?.name].filter(Boolean).join(" & ") || "Player";
      const bLabel = [r.bPlayer1.name, r.bPlayer2?.name].filter(Boolean).join(" & ") || "Player";

      return {
        id: r.id,
        createdBy: r.createdBy,
        aLabel,
        bLabel,
        aWins: record.aWins,
        bWins: record.bWins,
        totalMeetings: record.aWins + record.bWins,
        insight: rivalryInsight(record.meetings, aLabel, bLabel, record.aWins, record.bWins),
      };
    }),
  );
}

/** Guards against pinning the same two sides twice (in either order) and
 * against a side overlapping itself across A/B. */
export async function rivalryAlreadyExists(groupId: string, a: RivalrySide, b: RivalrySide): Promise<boolean> {
  const rows = await db.query.rivalries.findMany({ where: eq(rivalries.groupId, groupId) });
  const sameSide = (x: RivalrySide, p1: string, p2: string | null) =>
    (x.player1Id === p1 && x.player2Id === p2) || (x.player1Id === p2 && x.player2Id === p1);
  return rows.some(
    (r) =>
      (sameSide(a, r.aPlayer1Id, r.aPlayer2Id) && sameSide(b, r.bPlayer1Id, r.bPlayer2Id)) ||
      (sameSide(a, r.bPlayer1Id, r.bPlayer2Id) && sameSide(b, r.aPlayer1Id, r.aPlayer2Id)),
  );
}
