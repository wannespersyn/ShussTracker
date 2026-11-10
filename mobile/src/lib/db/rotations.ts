/**
 * Rotation types (shared)
 *
 * The shape of an Americano / Mexicano as GET /api/v1/rotations/{id}
 * returns it — the website's RotationView from lib/db/rotations.ts, without
 * the database code. Lets @shared/rotation-view resolve "@/lib/db/rotations".
 */
import type { RotationGameResult, RotationMode, RotationStanding, TiebreakKey } from "@shared/rotation";

export type RotationGameView = RotationGameResult & { id: string; idx: number; gameId: string | null; played: boolean };
export type RotationView = {
  id: string;
  groupId: string;
  name: string;
  mode: RotationMode;
  mats: number;
  rounds: number;
  status: "setup" | "active" | "completed";
  createdBy: string;
  players: { id: string; name: string; active: boolean }[];
  tiebreaks: TiebreakKey[];
  games: RotationGameView[];
  byes: Record<number, string[]>;
  standings: RotationStanding[];
  plannedRounds: number;
  crewElo: Record<string, number>;
};
export type RotationUpdate = { mats: number; rounds: number; activeIds: string[]; addIds: string[]; tiebreaks: TiebreakKey[] };
