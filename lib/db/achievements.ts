import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameTeamPlayers } from "@/lib/db/schema";
import type { CapRingColor } from "@/lib/theme/tokens";

type HistoryEntry = { playedAt: Date; won: boolean; shots: { fieldHit: string }[] };

async function getPlayerHistory(userId: string): Promise<HistoryEntry[]> {
  const rows = await db.query.gameTeamPlayers.findMany({
    where: eq(gameTeamPlayers.userId, userId),
    with: { gameTeam: { with: { game: true } }, shots: true },
  });
  return rows
    .map((r) => ({ playedAt: r.gameTeam.game.playedAt, won: r.gameTeam.finalRank === 1, shots: r.shots }))
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
}

type Definition = {
  id: string;
  glyph: string;
  name: string;
  description: string;
  ring: CapRingColor;
  /** Walks history chronologically; returns the index of the game that
   * first satisfies the achievement, or -1 if never satisfied. */
  firstEarnedIndex: (history: HistoryEntry[]) => number;
  /** True for achievements that only make sense with 1/2/3 zone tracking
   * on ("land 25 far-field 3s") — dropped entirely (not just unearned) for
   * a player with no "2"/"3" shots on record, rather than shown as a dead
   * goal they can never reach. */
  requiresZoneData?: boolean;
};

const gamesPlayedMilestone =
  (n: number): Definition["firstEarnedIndex"] =>
  (history) =>
    history.length >= n ? n - 1 : -1;

const winStreakMilestone =
  (n: number): Definition["firstEarnedIndex"] =>
  (history) => {
    let streak = 0;
    for (let i = 0; i < history.length; i++) {
      streak = history[i].won ? streak + 1 : 0;
      if (streak >= n) return i;
    }
    return -1;
  };

const shotCountMilestone =
  (fieldHit: string, n: number): Definition["firstEarnedIndex"] =>
  (history) => {
    let count = 0;
    for (let i = 0; i < history.length; i++) {
      count += history[i].shots.filter((s) => s.fieldHit === fieldHit).length;
      if (count >= n) return i;
    }
    return -1;
  };

const DEFINITIONS: Definition[] = [
  {
    id: "first-flick",
    glyph: "1",
    name: "First Flick",
    description: "Play your first game",
    ring: "gold",
    firstEarnedIndex: gamesPlayedMilestone(1),
  },
  {
    id: "regular",
    glyph: "10",
    name: "Regular",
    description: "Play 10 games",
    ring: "cream",
    firstEarnedIndex: gamesPlayedMilestone(10),
  },
  {
    id: "veteran",
    glyph: "25",
    name: "Veteran",
    description: "Play 25 games",
    ring: "cream",
    firstEarnedIndex: gamesPlayedMilestone(25),
  },
  {
    id: "legend",
    glyph: "50",
    name: "Legend",
    description: "Play 50 games",
    ring: "gold",
    firstEarnedIndex: gamesPlayedMilestone(50),
  },
  {
    id: "on-a-roll",
    glyph: "3×",
    name: "On A Roll",
    description: "Win 3 games in a row",
    ring: "gold",
    firstEarnedIndex: winStreakMilestone(3),
  },
  {
    id: "unstoppable",
    glyph: "5×",
    name: "Unstoppable",
    description: "Win 5 games in a row",
    ring: "gold",
    firstEarnedIndex: winStreakMilestone(5),
  },
  {
    id: "sharpshooter",
    glyph: "S",
    name: "Sharpshooter",
    description: "Land 25 far-field 3s",
    ring: "mint",
    firstEarnedIndex: shotCountMilestone("3", 25),
    requiresZoneData: true,
  },
  {
    id: "dead-eye",
    glyph: "S+",
    name: "Dead Eye",
    description: "Land 75 far-field 3s",
    ring: "mint",
    firstEarnedIndex: shotCountMilestone("3", 75),
    requiresZoneData: true,
  },
  {
    id: "red-zone-regular",
    glyph: "R",
    name: "Red Zone Regular",
    description: "Take 10 red-zone hits",
    ring: "red",
    firstEarnedIndex: shotCountMilestone("mama", 10),
  },
  {
    id: "chug-champion",
    glyph: "R+",
    name: "Chug Champion",
    description: "Take 30 red-zone hits",
    ring: "red",
    firstEarnedIndex: shotCountMilestone("mama", 30),
  },
];

export type AchievementResult = {
  id: string;
  glyph: string;
  name: string;
  description: string;
  ring: CapRingColor;
  earned: boolean;
  earnedAt: Date | null;
};

/** Fixed achievement catalog evaluated against a player's chronological
 * game/shot history. No dedicated table — `earnedAt` is the timestamp of
 * the game that crossed the threshold, derived by walking the history
 * forward, which also gives "recently unlocked" ordering for free. */
export async function getAchievements(userId: string): Promise<AchievementResult[]> {
  const history = await getPlayerHistory(userId);
  const hasZoneData = history.some((h) => h.shots.some((s) => s.fieldHit === "2" || s.fieldHit === "3"));

  return DEFINITIONS.filter((def) => !def.requiresZoneData || hasZoneData).map((def) => {
    const idx = def.firstEarnedIndex(history);
    return {
      id: def.id,
      glyph: def.glyph,
      name: def.name,
      description: def.description,
      ring: def.ring,
      earned: idx >= 0,
      earnedAt: idx >= 0 ? history[idx].playedAt : null,
    };
  });
}
