/**
 * GET /api/v1/tournaments/[tournamentId]
 *
 * The full tournament: bracket rounds (winners / losers / grand final) or
 * round-robin rounds with standings, the champion once decided, and which
 * matches can be played now. Crew members only.
 */
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getTournament } from "@/lib/db/tournaments";

type Ctx = { params: Promise<{ tournamentId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  if (!tournament) throw notFound();
  await requireGroupMember(userId, tournament.groupId).catch(() => {
    throw notFound();
  });
  return { tournament };
});
