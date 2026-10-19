/**
 * GET /api/v1/crews/[crewId]
 *
 * Everything the crew screens need in one call: the crew, the full insights
 * (leaderboard, duos, sessions, Elo per game), its guests and tournaments.
 * The invite code is only included for the owner. Members only.
 *
 * PATCH  → owner: `{ name?, trackShotZones? }` renames / sets the crew's
 *          "track every shot" default.
 * DELETE → owner: deletes the crew (games stay on record, crew-less).
 */
import { api, badRequest, notFound, readJson } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { deleteCrew, renameCrew, setTrackShotZones } from "@/lib/db/crews";
import { expireCrew } from "@/lib/cache-tags";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewGuests } from "@/lib/db/guests";
import { getGroupTournaments } from "@/lib/db/tournaments";
import { isPro } from "@/lib/plan";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const crew = await getCrew(crewId);
  if (!crew) throw notFound();

  const [insights, guests, tournaments] = await Promise.all([getCrewInsights(crewId), getCrewGuests(crewId), getGroupTournaments(crewId)]);
  const isOwner = crew.createdBy === userId;
  return {
    crew: {
      id: crew.id,
      name: crew.name,
      createdBy: crew.createdBy,
      isOwner,
      plan: crew.plan,
      isPro: isPro(crew),
      trackShotZones: crew.trackShotZones,
      inviteCode: isOwner ? crew.inviteCode : undefined,
    },
    insights,
    guests,
    tournaments,
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
  if (body.trackShotZones !== undefined) {
    if (typeof body.trackShotZones !== "boolean") throw badRequest('"trackShotZones" must be a boolean');
    await setTrackShotZones(crewId, body.trackShotZones);
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
