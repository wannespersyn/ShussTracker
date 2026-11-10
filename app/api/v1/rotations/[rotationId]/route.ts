/**
 * /api/v1/rotations/[rotationId]
 *
 * GET   → the whole Americano / Mexicano: players, planned games with
 *         results, byes, standings, crew Elo, plus the crew roster (for
 *         adding players) and whether the viewer may organize it.
 * PATCH → organizer: `{ mats, rounds, activeIds, addIds, tiebreaks }`
 *         changes it mid-night (lib/db/rotations.ts updateRotation).
 */
import { eq } from "drizzle-orm";
import { api, badRequest, notFound, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireRotationMember, updateRotationAs } from "@/lib/services/rotations";
import { getCrewInsights } from "@/lib/db/crew-insights";
import { TIEBREAK_KEYS, type TiebreakKey } from "@/lib/rotation";

type Ctx = { params: Promise<{ rotationId: string }> };

async function load(rotationId: string, userId: string) {
  try {
    return await requireRotationMember(rotationId, userId);
  } catch (e) {
    if ((e as Error).message === "Tournament not found" || (e as Error).name === "ForbiddenError") throw notFound();
    throw e;
  }
}

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { rotationId } = await params;
  const rotation = await load(rotationId, userId);
  const [crew, insights] = await Promise.all([
    db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { id: true, name: true, createdBy: true } }),
    getCrewInsights(rotation.groupId),
  ]);
  return {
    rotation,
    crew: crew ? { id: crew.id, name: crew.name } : null,
    canManage: rotation.createdBy === userId || crew?.createdBy === userId,
    roster: insights.players.map((p) => ({ id: p.userId, name: p.name, isGuest: p.isGuest, elo: p.elo, games: p.games })),
  };
});

const ids = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null);

export const PATCH = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { rotationId } = await params;
  await load(rotationId, userId);
  const body = await readJson(req);
  const activeIds = ids(body.activeIds);
  const addIds = ids(body.addIds) ?? [];
  const tiebreaks = (ids(body.tiebreaks) ?? []).filter((k): k is TiebreakKey => (TIEBREAK_KEYS as string[]).includes(k));
  const mats = Number(body.mats);
  const rounds = Number(body.rounds);
  if (!activeIds || !Number.isFinite(mats) || !Number.isFinite(rounds)) throw badRequest('Send { "mats", "rounds", "activeIds", "addIds", "tiebreaks" }');
  try {
    await updateRotationAs(userId, rotationId, { mats: Math.min(8, Math.max(1, Math.round(mats))), rounds, activeIds, addIds, tiebreaks });
  } catch (e) {
    if (e instanceof Error && /crew|players/.test(e.message)) throw badRequest(e.message);
    throw e;
  }
});
