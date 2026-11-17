/**
 * GET /api/v1/crews/[crewId]
 *
 * Everything the crew screens need in one call: the crew, the full insights
 * (leaderboard, duos, sessions, Elo per game), its guests, tournaments, the
 * crew's events (brackets + Americano/Mexicano) and live beta cameras.
 * The invite code is only included for the owner. Members only.
 *
 * PATCH  → owner: `{ name }` renames the crew; `{ rules }` sets the game,
 *          theme and house rules (lib/rules.ts; invalid values fall back).
 * DELETE → owner: deletes the crew (games stay on record, crew-less).
 */
import { api, badRequest, notFound, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { deleteCrew, renameCrew, setCrewRules } from "@/lib/db/crews";
import { parseRuleset } from "@/lib/rules";
import { expireCrew } from "@/lib/cache-tags";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewGuests } from "@/lib/db/guests";
import { getGroupTournaments } from "@/lib/db/tournaments";
import { getCrewEvents } from "@/lib/db/crew-events";
import { getLiveCameras } from "@/lib/db/camera";
import { isPro } from "@/lib/plan";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const crew = await getCrew(crewId);
  if (!crew) throw notFound();

  const [insights, guests, tournaments, events, cameras] = await Promise.all([
    getCrewInsights(crewId),
    getCrewGuests(crewId),
    getGroupTournaments(crewId),
    getCrewEvents(crewId, { limit: 12 }),
    getLiveCameras(crewId),
  ]);
  const isOwner = crew.createdBy === userId;
  return {
    crew: {
      id: crew.id,
      name: crew.name,
      createdBy: crew.createdBy,
      isOwner,
      plan: crew.plan,
      isPro: isPro(crew),
      inviteCode: isOwner ? crew.inviteCode : undefined,
      rules: parseRuleset(crew.rules),
      /** False until the owner picked a game / house rules (kickstart checklist). */
      rulesSet: crew.rules !== null,
    },
    insights,
    guests,
    tournaments,
    events,
    cameras,
  };
});

export const PATCH = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupOwner(userId, crewId);
  const body = await readJson(req);
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) throw badRequest('"name" must be a non-empty string');
    await renameCrew(crewId, body.name.trim().slice(0, 40));
  }
  if (body.rules !== undefined) {
    if (body.rules === null || typeof body.rules !== "object") throw badRequest('"rules" must be an object');
    await setCrewRules(crewId, body.rules);
  }
  expireCrew(crewId);
});

export const DELETE = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupOwner(userId, crewId);
  await deleteCrew(crewId);
  expireCrew(crewId);
});
