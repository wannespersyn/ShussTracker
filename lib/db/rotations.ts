/**
 * Rotation tournaments — data access
 *
 * Creates an Americano/Mexicano (players, planned rounds), loads it with
 * results and standings, records a played game (and for Mexicano plans the
 * next round once a round is done), and closes it.
 *
 * Data: rotation / rotation_player / rotation_game, results via the linked
 * `game` rows; Elo per game from the crew insights. Logic in lib/rotation.ts.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { runAtomic } from "@/lib/db/batch";
import { games, rotationGames, rotationPlayers, rotations, users } from "@/lib/db/schema";
import { getCrewInsights } from "@/lib/db/crew-insights";
import {
  planAmericano,
  planMexicanoRound,
  rotationStandings,
  type RotationGameResult,
  type RotationMode,
  type RotationRound,
  type RotationStanding,
} from "@/lib/rotation";

export const ROTATION_MAX_PLAYERS = 24;
export const ROTATION_MAX_ROUNDS = 30;

const gameRows = (rotationId: string, round: number, r: RotationRound) =>
  r.games.map((g, idx) => ({ id: randomUUID(), rotationId, round, idx, a1: g.a[0], a2: g.a[1], b1: g.b[0], b2: g.b[1] }));

/** Creates the rotation. Americano plans every round now; Mexicano plans
 * round 1 balanced on crew Elo (strongest with weakest). */
export async function createRotation(input: {
  groupId: string;
  createdBy: string;
  name: string;
  mode: RotationMode;
  playerIds: string[];
  mats: number;
  rounds: number;
}): Promise<string> {
  const playerIds = [...new Set(input.playerIds)];
  if (playerIds.length < 4 || playerIds.length > ROTATION_MAX_PLAYERS) throw new Error("A rotation needs 4–24 players");
  const rounds = Math.min(ROTATION_MAX_ROUNDS, Math.max(1, Math.round(input.rounds)));
  const mats = Math.min(8, Math.max(1, Math.round(input.mats)));
  const id = randomUUID();

  let planned: RotationRound[];
  if (input.mode === "americano") {
    planned = planAmericano(playerIds, rounds);
  } else {
    const insights = await getCrewInsights(input.groupId);
    const elo = new Map(insights.players.map((p) => [p.userId, p.elo]));
    const byElo = [...playerIds].sort((a, b) => (elo.get(b) ?? 1000) - (elo.get(a) ?? 1000));
    planned = [planMexicanoRound(byElo, [], [])];
  }

  await runAtomic((x) => [
    x.insert(rotations).values({ id, groupId: input.groupId, name: input.name, mode: input.mode, mats, rounds, createdBy: input.createdBy }),
    x.insert(rotationPlayers).values(playerIds.map((userId) => ({ rotationId: id, userId }))),
    x.insert(rotationGames).values(planned.flatMap((r, i) => gameRows(id, i + 1, r))),
  ]);
  return id;
}

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
  players: { id: string; name: string }[];
  games: RotationGameView[];
  /** Per planned round, who sits out. */
  byes: Record<number, string[]>;
  standings: RotationStanding[];
  /** Highest round that has games planned. */
  plannedRounds: number;
};

export async function getRotation(rotationId: string): Promise<RotationView | null> {
  const rotation = await db.query.rotations.findFirst({ where: eq(rotations.id, rotationId) });
  if (!rotation) return null;
  const [playerRows, rows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(rotationPlayers)
      .innerJoin(users, eq(users.id, rotationPlayers.userId))
      .where(eq(rotationPlayers.rotationId, rotationId)),
    db.query.rotationGames.findMany({ where: eq(rotationGames.rotationId, rotationId), orderBy: [asc(rotationGames.round), asc(rotationGames.idx)] }),
  ]);
  const gameIds = rows.map((r) => r.gameId).filter((x): x is string => !!x);
  const [played, insights] = await Promise.all([
    gameIds.length
      ? db.query.games.findMany({
          where: inArray(games.id, gameIds),
          columns: { id: true },
          with: { teams: { columns: { finalRank: true, kruip: true }, with: { players: { columns: { userId: true }, with: { shots: { columns: { fieldHit: true } } } } } } },
        })
      : Promise.resolve([]),
    gameIds.length ? getCrewInsights(rotation.groupId) : Promise.resolve(null),
  ]);
  const byId = new Map(played.map((g) => [g.id, g]));

  const list: RotationGameView[] = rows.map((r) => {
    const g = r.gameId ? byId.get(r.gameId) : undefined;
    const teamOf = (id: string) => g?.teams.find((t) => t.players.some((p) => p.userId === id));
    const tA = teamOf(r.a1);
    const tB = teamOf(r.b1);
    const mama: Record<string, number> = {};
    for (const t of g?.teams ?? []) for (const p of t.players) mama[p.userId] = p.shots.filter((s) => s.fieldHit === "mama").length;
    return {
      id: r.id,
      idx: r.idx,
      round: r.round,
      a: [r.a1, r.a2],
      b: [r.b1, r.b2],
      gameId: r.gameId,
      played: !!g,
      aWon: g ? tA?.finalRank === 1 : null,
      kruipA: tA?.kruip ?? false,
      kruipB: tB?.kruip ?? false,
      mama,
      elo: g && insights ? (insights.gameElo[g.id] ?? {}) : {},
    };
  });

  const playerIds = playerRows.map((p) => p.id);
  const plannedRounds = Math.max(0, ...list.map((g) => g.round));
  const byes: Record<number, string[]> = {};
  for (let r = 1; r <= plannedRounds; r++) {
    const inRound = new Set(list.filter((g) => g.round === r).flatMap((g) => [...g.a, ...g.b]));
    byes[r] = playerIds.filter((id) => !inRound.has(id));
  }

  return {
    id: rotation.id,
    groupId: rotation.groupId,
    name: rotation.name,
    mode: rotation.mode,
    mats: rotation.mats,
    rounds: rotation.rounds,
    status: rotation.status,
    createdBy: rotation.createdBy,
    players: playerRows.map((p) => ({ id: p.id, name: p.name ?? "Player" })),
    games: list,
    byes,
    standings: rotationStandings(playerIds, list, Object.values(byes)),
    plannedRounds,
  };
}

export async function getRotationGame(rotationGameId: string) {
  return db.query.rotationGames.findFirst({ where: eq(rotationGames.id, rotationGameId) });
}

/** Links a played game to its slot (only if still open — a second phone
 * logging the same game loses), then for Mexicano plans the next round once
 * this round is done, and closes the rotation after the last game. Returns
 * false if the slot was already played. */
export async function recordRotationGame(rotationGameId: string, gameId: string): Promise<boolean> {
  const updated = await db
    .update(rotationGames)
    .set({ gameId })
    .where(and(eq(rotationGames.id, rotationGameId), isNull(rotationGames.gameId)))
    .returning();
  const row = updated[0];
  if (!row) return false;
  await advanceRotation(row.rotationId);
  return true;
}

async function advanceRotation(rotationId: string) {
  const view = await getRotation(rotationId);
  if (!view || view.status === "completed") return;
  const open = view.games.filter((g) => !g.played);
  if (open.length > 0) return;
  if (view.mode === "mexicano" && view.plannedRounds < view.rounds) {
    const next = planMexicanoRound(
      view.standings.map((s) => s.userId),
      view.games,
      Object.values(view.byes),
    );
    // Unique (rotation, round, idx): if two games finish at once, only one plan lands.
    await db
      .insert(rotationGames)
      .values(gameRows(rotationId, view.plannedRounds + 1, next))
      .onConflictDoNothing();
    return;
  }
  await db.update(rotations).set({ status: "completed" }).where(eq(rotations.id, rotationId));
}

/** Ends the rotation early: unplayed games are dropped, standings stay. */
export async function finishRotation(rotationId: string) {
  await runAtomic((x) => [
    x.delete(rotationGames).where(and(eq(rotationGames.rotationId, rotationId), isNull(rotationGames.gameId))),
    x.update(rotations).set({ status: "completed" }).where(eq(rotations.id, rotationId)),
  ]);
}

export async function getGroupRotations(groupId: string) {
  const rows = await db.query.rotations.findMany({ where: eq(rotations.groupId, groupId) });
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
