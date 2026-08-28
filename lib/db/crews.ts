import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { groups, groupMembers, games } from "@/lib/db/schema";
import { wilsonLowerBound } from "@/lib/ranking";
import { computeEloRatings, ELO_BASE } from "@/lib/elo";
import { generateCode } from "@/lib/codes";

function isToday(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const generateInviteCode = generateCode;

export async function createCrewForUser(userId: string, name: string) {
  const groupId = randomUUID();
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select().from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  await runAtomic((executor) => [
    executor.insert(groups).values({ id: groupId, name, inviteCode, createdBy: userId }),
    executor.insert(groupMembers).values({ groupId, userId }),
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

export async function renameCrew(groupId: string, name: string) {
  await db.update(groups).set({ name }).where(eq(groups.id, groupId));
}

export async function setTrackShotZones(groupId: string, trackShotZones: boolean) {
  await db.update(groups).set({ trackShotZones }).where(eq(groups.id, groupId));
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select().from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
    if (!existing) break;
    inviteCode = generateInviteCode();
  }
  await db.update(groups).set({ inviteCode }).where(eq(groups.id, groupId));
  return inviteCode;
}

/** Also used for a member leaving a crew on their own — same underlying
 * operation, just called with their own userId and a member-level (not
 * owner-level) authz check at the call site. */
export async function removeCrewMember(groupId: string, userId: string) {
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

/** Members cascade-delete via the FK; games/events that referenced this
 * crew survive with `groupId` set to null (schema's onDelete: "set null") —
 * historical stats aren't wiped out from under anyone. */
export async function deleteCrew(groupId: string) {
  await db.delete(groups).where(eq(groups.id, groupId));
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
    .sort(
      (a, b) =>
        wilsonLowerBound(b.wins, b.gamesPlayed) - wilsonLowerBound(a.wins, a.gamesPlayed) ||
        b.wins - a.wins ||
        b.gamesPlayed - a.gamesPlayed,
    );
}

export type CrewEloEntry = {
  userId: string;
  name: string;
  rating: number;
  gamesPlayed: number;
};

/** Per-member Elo rating for a crew, ranked highest first — accounts for
 * who you beat (and who they'd already beaten), not just a raw win tally.
 * See lib/elo.ts for the rating math. Members who haven't played yet get
 * the base rating and sort to the bottom, tied on games played. */
export async function getCrewEloLeaderboard(groupId: string): Promise<CrewEloEntry[]> {
  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, groupId),
    with: { user: true },
  });

  const groupGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: { teams: { with: { players: true } } },
  });

  const ratings = computeEloRatings(
    groupGames.map((g) => ({
      playedAt: g.playedAt,
      teams: g.teams.map((t) => ({ playerIds: t.players.map((p) => p.userId), finalRank: t.finalRank })),
    })),
  );

  return members
    .map((m) => {
      const r = ratings.get(m.userId);
      return {
        userId: m.userId,
        name: m.user.name ?? "Player",
        rating: r?.rating ?? ELO_BASE,
        gamesPlayed: r?.gamesPlayed ?? 0,
      };
    })
    .sort((a, b) => b.rating - a.rating || b.gamesPlayed - a.gamesPlayed);
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

export type CrewBestDuo = {
  aUserId: string;
  aName: string;
  bUserId: string;
  bName: string;
  wins: number;
  losses: number;
};

/** The best 2-player pairing across a crew's whole history, ranked by wins
 * together — for the crew detail page's "Best partner" card. Returns null
 * once no pair has shared a team. */
export async function getCrewBestDuo(groupId: string): Promise<CrewBestDuo | null> {
  const groupGames = await db.query.games.findMany({
    where: eq(games.groupId, groupId),
    with: { teams: { with: { players: { with: { user: true } } } } },
  });

  type DuoTally = { a: { userId: string; name: string }; b: { userId: string; name: string }; wins: number; losses: number };
  const tally = new Map<string, DuoTally>();
  for (const game of groupGames) {
    for (const team of game.teams) {
      if (team.players.length !== 2) continue;
      const [p1, p2] = team.players;
      const key = [p1.userId, p2.userId].sort().join("+");
      const entry = tally.get(key) ?? {
        a: { userId: p1.userId, name: p1.user.name ?? "Player" },
        b: { userId: p2.userId, name: p2.user.name ?? "Player" },
        wins: 0,
        losses: 0,
      };
      if (team.finalRank === 1) entry.wins++;
      else entry.losses++;
      tally.set(key, entry);
    }
  }

  let best: DuoTally | null = null;
  for (const duo of tally.values()) {
    if (!best || duo.wins > best.wins || (duo.wins === best.wins && duo.wins + duo.losses > best.wins + best.losses)) {
      best = duo;
    }
  }
  if (!best) return null;
  return { aUserId: best.a.userId, aName: best.a.name, bUserId: best.b.userId, bName: best.b.name, wins: best.wins, losses: best.losses };
}
