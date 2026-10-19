/**
 * GET /api/v1/crews/[crewId]
 *
 * Everything the crew screens need in one call: the crew, the full insights
 * (leaderboard, duos, sessions, Elo per game), its guests and tournaments.
 * The invite code is only included for the owner. Members only.
 */
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
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
