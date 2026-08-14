import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, groupMembers, games } from "@/lib/db/schema";

function isToday(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// Uppercase, no 0/O/1/I — hard to mistype when read off a phone screen.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function createCrewForUser(userId: string, name: string) {
  const groupId = randomUUID();
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select().from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  await db.batch([
    db.insert(groups).values({ id: groupId, name, inviteCode, createdBy: userId }),
    db.insert(groupMembers).values({ groupId, userId }),
  ]);

  return groupId;
}

export async function joinCrewByCode(
  userId: string,
  rawCode: string,
): Promise<{ groupId: string; error?: undefined } | { error: string; groupId?: undefined }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Enter a crew code" };

  const [group] = await db.select().from(groups).where(eq(groups.inviteCode, code)).limit(1);
  if (!group) return { error: "That code doesn't match a crew" };

  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!existing) {
    await db.insert(groupMembers).values({ groupId: group.id, userId });
  }

  return { groupId: group.id };
}

export type CrewLeaderboardEntry = {
  userId: string;
  name: string;
  wins: number;
  gamesPlayed: number;
};

/** Per-member win/games-played tally for a crew, ranked best first.
 * Pass `{ onlyToday: true }` to scope it to games played today, for the
 * crew leaderboard's "Tonight" tab. */
export async function getCrewLeaderboard(
  groupId: string,
  opts: { onlyToday?: boolean } = {},
): Promise<CrewLeaderboardEntry[]> {
  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });

  const groupGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: { teams: { with: { players: true } } },
  });
  const scopedGames = opts.onlyToday ? groupGames.filter((g) => isToday(g.playedAt)) : groupGames;

  const played = new Map<string, number>();
  const wins = new Map<string, number>();
  for (const game of scopedGames) {
    for (const team of game.teams) {
      for (const player of team.players) {
        played.set(player.userId, (played.get(player.userId) ?? 0) + 1);
        if (team.finalRank === 1) wins.set(player.userId, (wins.get(player.userId) ?? 0) + 1);
      }
    }
  }

  return members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name ?? "Player",
      wins: wins.get(m.userId) ?? 0,
      gamesPlayed: played.get(m.userId) ?? 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);
}

export type CrewRedZoneEntry = {
  userId: string;
  name: string;
  chugs: number;
  gamesPlayed: number;
};

/** Per-member risk-zone (mama) shot tally for a crew, ranked most-chugs
 * first, for the crew leaderboard's "Red zone" tab. */
export async function getCrewRedZoneLeaderboard(groupId: string): Promise<CrewRedZoneEntry[]> {
  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });

  const groupGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: { teams: { with: { players: { with: { shots: true } } } } },
  });

  const played = new Map<string, number>();
  const chugs = new Map<string, number>();
  for (const game of groupGames) {
    for (const team of game.teams) {
      for (const player of team.players) {
        played.set(player.userId, (played.get(player.userId) ?? 0) + 1);
        const mamaShots = player.shots.filter((s) => s.fieldHit === "mama").length;
        if (mamaShots > 0) chugs.set(player.userId, (chugs.get(player.userId) ?? 0) + mamaShots);
      }
    }
  }

  return members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name ?? "Player",
      chugs: chugs.get(m.userId) ?? 0,
      gamesPlayed: played.get(m.userId) ?? 0,
    }))
    .sort((a, b) => b.chugs - a.chugs || b.gamesPlayed - a.gamesPlayed);
}
