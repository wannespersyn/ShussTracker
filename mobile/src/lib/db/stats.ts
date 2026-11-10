/**
 * Stats types (shared)
 *
 * The shape of GET /api/v1/stats — the website's StatsExplorerData from
 * lib/db/stats.ts, without the database code. Lets @shared/stats-scope
 * resolve "@/lib/db/stats".
 */
export type StatsPerson = { id: string; name: string };
export type StatsCrew = { id: string; name: string; memberCount: number };
export type StatsFieldCounts = { far: number; mid: number; near: number; risk: number; miss: number };
export type StatsTeam = { userIds: string[]; won: boolean; points: number; shots: Record<string, StatsFieldCounts>; kruip: boolean };
export type StatsEloPoint = { g: string; t: string; r: number; d: number };
export type StatsGame = { id: string; crewId: string | null; matType: "2" | "4" | "8"; playedAt: string; teams: StatsTeam[] };
export type StatsExplorerData = {
  people: StatsPerson[];
  crews: StatsCrew[];
  games: StatsGame[];
  elo: Record<string, Record<string, StatsEloPoint[]>>;
  hasZoneData: boolean;
};
