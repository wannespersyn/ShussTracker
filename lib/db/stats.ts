import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, games, gameTeamPlayers, groupMembers, shots } from "@/lib/db/schema";
import { scoreForPlayers as scoreFor } from "@/lib/scoring";

export type ShotDistributionEntry = { fieldHit: string; label: string; count: number; pct: number };

/** Where a player's caps land, bucketed far -> near -> risk -> miss, for the
 * home dashboard "Where the caps land" bar chart. `makeRate` is the share of
 * all shots that landed in a scoring zone (1/2/3), excluding risk and miss. */
export async function getShotDistribution(
  userId: string,
): Promise<{ makeRate: number; bars: ShotDistributionEntry[] }> {
  const rows = await db
    .select({ fieldHit: shots.fieldHit })
    .from(shots)
    .innerJoin(gameTeamPlayers, eq(shots.gameTeamPlayerId, gameTeamPlayers.id))
    .where(eq(gameTeamPlayers.userId, userId));

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.fieldHit, (counts.get(r.fieldHit) ?? 0) + 1);

  const total = rows.length;
  const scoring = (counts.get("1") ?? 0) + (counts.get("2") ?? 0) + (counts.get("3") ?? 0);
  const makeRate = total > 0 ? Math.round((scoring / total) * 100) : 0;

  // Collapse NEAR/MID/FAR into a single HIT bucket whenever this player has
  // no "2"/"3" shots on record — either their crew never tracks zones, or
  // they haven't played since it was turned on. No point showing two bars
  // permanently pinned at zero.
  const hasZoneData = (counts.get("2") ?? 0) > 0 || (counts.get("3") ?? 0) > 0;
  const order = hasZoneData
    ? [
        { fieldHit: "3", label: "FAR" },
        { fieldHit: "2", label: "MID" },
        { fieldHit: "1", label: "NEAR" },
        { fieldHit: "mama", label: "RISK" },
        { fieldHit: "miss", label: "MISS" },
      ]
    : [
        { fieldHit: "1", label: "HIT" },
        { fieldHit: "mama", label: "RISK" },
        { fieldHit: "miss", label: "MISS" },
      ];
  const max = Math.max(1, ...order.map((o) => counts.get(o.fieldHit) ?? 0));
  const bars = order.map((o) => {
    const count = counts.get(o.fieldHit) ?? 0;
    return { fieldHit: o.fieldHit, label: o.label, count, pct: Math.round((count / max) * 100) };
  });

  return { makeRate, bars };
}

export type BestDuo = { partnerUserId: string; partnerName: string; wins: number; losses: number };

/** The teammate a player has won with the most, for the home dashboard
 * "Best duo" card. Returns null if they haven't played any games. */
export async function getBestDuo(userId: string): Promise<BestDuo | null> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: true },
  });
  if (myRows.length === 0) return null;

  const teamIds = myRows.map((r) => r.gameTeamId);
  const teammateRows = await db.query.gameTeamPlayers.findMany({
    where: inArray(gameTeamPlayers.gameTeamId, teamIds),
    with: { user: true },
  });

  const finalRankByTeam = new Map(myRows.map((r) => [r.gameTeamId, r.gameTeam.finalRank]));

  const tally = new Map<string, BestDuo>();
  for (const row of teammateRows) {
    if (row.userId === userId) continue;
    const finalRank = finalRankByTeam.get(row.gameTeamId);
    if (finalRank == null) continue;
    const entry = tally.get(row.userId) ?? {
      partnerUserId: row.userId,
      partnerName: row.user.name ?? "Player",
      wins: 0,
      losses: 0,
    };
    if (finalRank === 1) entry.wins++;
    else entry.losses++;
    tally.set(row.userId, entry);
  }

  let best: BestDuo | null = null;
  for (const duo of tally.values()) {
    if (!best || duo.wins > best.wins || (duo.wins === best.wins && duo.wins + duo.losses > best.wins + best.losses)) {
      best = duo;
    }
  }
  return best;
}

export type RecentGame = {
  id: string;
  playedAt: Date;
  result: "W" | "L";
  myScore: number;
  oppScore: number;
  opponentLabel: string;
  teammateLabel: string | undefined;
  matType: "2" | "4" | "8";
};

/** A player's most recent games with the rival team's score and name, for
 * the home dashboard "Last nights" history list. The rival is the
 * best-placed opposing team (relevant for 8-player mats with 3+ teams). */
export async function getRecentGamesDetail(userId: string, limit = 3): Promise<RecentGame[]> {
  const myRows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } } },
  });
  const recent = [...myRows]
    .sort((a, b) => new Date(b.gameTeam.game.playedAt).getTime() - new Date(a.gameTeam.game.playedAt).getTime())
    .slice(0, limit);
  if (recent.length === 0) return [];

  const gameIds = recent.map((r) => r.gameTeam.game.id);
  const fullGames = await db.query.games.findMany({
    where: inArray(games.id, gameIds),
    with: { teams: { with: { players: { with: { user: true, shots: true } } } } },
  });
  const gameById = new Map(fullGames.map((g) => [g.id, g]));

  return recent.map((row) => {
    const game = gameById.get(row.gameTeam.game.id)!;
    const myTeam = game.teams.find((t) => t.id === row.gameTeamId)!;
    const rival = game.teams
      .filter((t) => t.id !== myTeam.id)
      .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99))[0];
    const teammates = myTeam.players.filter((p) => p.userId !== userId);

    return {
      id: game.id,
      playedAt: game.playedAt,
      result: myTeam.finalRank === 1 ? "W" : "L",
      myScore: scoreFor(myTeam.players),
      oppScore: rival ? scoreFor(rival.players) : 0,
      opponentLabel: rival ? rival.players.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & ") : "—",
      teammateLabel:
        teammates.length > 0
          ? teammates.map((p) => p.user.name?.split(" ")[0] ?? "Player").join(" & ")
          : undefined,
      matType: game.matType,
    };
  });
}

/** Win streaks of this length or longer earn the "on fire" badge — matches
 * the "On A Roll" achievement threshold in lib/db/achievements.ts. */
export const ON_FIRE_STREAK = 3;

export type PlayerStatsSummary = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  longestStreak: number;
  onFire: boolean;
  riskZone: number;
  shotDist: { makeRate: number; bars: ShotDistributionEntry[] } | null;
  bestDuo: BestDuo | null;
  recentGames: RecentGame[];
};

/** Everything the "my stats" card cluster needs (win rate, streak, red
 * zone, shot distribution, best duo, recent games) — used by both the
 * Home dashboard ("you") and a player's profile page (any player). */
export async function getPlayerStatsSummary(userId: string): Promise<PlayerStatsSummary> {
  const played = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } }, shots: true },
  });

  const byRecent = [...played].sort(
    (a, b) => new Date(b.gameTeam.game.playedAt).getTime() - new Date(a.gameTeam.game.playedAt).getTime(),
  );
  const totalGames = byRecent.length;
  const wins = byRecent.filter((g) => g.gameTeam.finalRank === 1).length;
  const losses = totalGames - wins;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  let streak = 0;
  for (const g of byRecent) {
    if (g.gameTeam.finalRank === 1) streak++;
    else break;
  }

  let longestStreak = 0;
  let running = 0;
  for (let i = byRecent.length - 1; i >= 0; i--) {
    if (byRecent[i].gameTeam.finalRank === 1) {
      running++;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }
  const onFire = streak >= ON_FIRE_STREAK;

  const riskZone = byRecent.reduce((sum, g) => sum + g.shots.filter((s) => s.fieldHit === "mama").length, 0);

  const [shotDist, bestDuo, recentGames] =
    totalGames > 0
      ? await Promise.all([getShotDistribution(userId), getBestDuo(userId), getRecentGamesDetail(userId, 3)])
      : [null, null, []];

  return { totalGames, wins, losses, winRate, streak, longestStreak, onFire, riskZone, shotDist, bestDuo, recentGames };
}

export type StatsPerson = { id: string; name: string };
export type StatsCrew = { id: string; name: string; memberCount: number };
export type StatsEvent = { id: string; name: string; crewId: string; date: string };
export type StatsFieldCounts = { far: number; mid: number; near: number; risk: number; miss: number };
export type StatsTeam = { userIds: string[]; won: boolean; points: number; shots: Record<string, StatsFieldCounts> };
export type StatsGame = {
  id: string;
  crewId: string | null;
  eventId: string | null;
  matType: "2" | "4" | "8";
  playedAt: string;
  teams: StatsTeam[];
};
export type StatsExplorerData = {
  people: StatsPerson[];
  crews: StatsCrew[];
  events: StatsEvent[];
  games: StatsGame[];
  /** True once any game in scope has a "2" or "3" shot on record — lets the
   * explorer collapse the far/mid/near breakdown into a single HIT filter
   * when nobody here has ever tracked shot zones. */
  hasZoneData: boolean;
};

function tallyShots(playerShots: { fieldHit: string }[]): StatsFieldCounts {
  const c: StatsFieldCounts = { far: 0, mid: 0, near: 0, risk: 0, miss: 0 };
  for (const s of playerShots) {
    if (s.fieldHit === "3") c.far++;
    else if (s.fieldHit === "2") c.mid++;
    else if (s.fieldHit === "1") c.near++;
    else if (s.fieldHit === "mama") c.risk++;
    else if (s.fieldHit === "miss") c.miss++;
  }
  return c;
}

/** Everything the Stats deep-dive page needs to filter and aggregate
 * client-side in one shot: every game (with per-player shot tallies) across
 * every crew the user belongs to, plus the people/crews/events those games
 * reference. Small enough (a hobby-league's worth of games) to ship whole
 * and let the filter chips slice it in the browser, matching how the design
 * itself was built (see the `Component` class in the source .dc.html). */
export async function getStatsExplorerData(userId: string): Promise<StatsExplorerData> {
  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: { with: { members: { with: { user: true } } } } },
  });
  if (memberships.length === 0) {
    return { people: [], crews: [], events: [], games: [], hasZoneData: false };
  }

  const groupIds = memberships.map((m) => m.groupId);

  const peopleById = new Map<string, StatsPerson>();
  const crews: StatsCrew[] = memberships.map((m) => {
    for (const gm of m.group.members) {
      peopleById.set(gm.userId, { id: gm.userId, name: gm.user.name ?? "Player" });
    }
    return { id: m.group.id, name: m.group.name, memberCount: m.group.members.length };
  });

  const groupEvents = await db.query.events.findMany({ where: inArray(events.groupId, groupIds) });
  const eventList: StatsEvent[] = groupEvents
    .filter((e) => e.groupId !== null)
    .map((e) => ({ id: e.id, name: e.name, crewId: e.groupId as string, date: e.date }));

  const groupGames = await db.query.games.findMany({
    where: inArray(games.groupId, groupIds),
    with: { teams: { with: { players: { with: { shots: true } } } } },
  });

  const gameList: StatsGame[] = groupGames.map((g) => ({
    id: g.id,
    crewId: g.groupId,
    eventId: g.eventId,
    matType: g.matType,
    playedAt: g.playedAt.toISOString(),
    teams: g.teams.map((t) => {
      const shots: Record<string, StatsFieldCounts> = {};
      let points = 0;
      for (const p of t.players) {
        const counts = tallyShots(p.shots);
        shots[p.userId] = counts;
        points += counts.near + counts.mid * 2 + counts.far * 3;
      }
      return { userIds: t.players.map((p) => p.userId), won: t.finalRank === 1, points, shots };
    }),
  }));

  const hasZoneData = gameList.some((g) =>
    g.teams.some((t) => Object.values(t.shots).some((s) => s.mid > 0 || s.far > 0)),
  );

  return { people: [...peopleById.values()], crews, events: eventList, games: gameList, hasZoneData };
}
