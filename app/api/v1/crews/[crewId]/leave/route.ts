/**
 * POST /api/v1/crews/[crewId]/leave
 *
 * Leaves a crew. The owner can't leave their own crew (409) — same rule as
 * the website, where only non-owners see "Leave crew".
 */
import { ApiError, api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getCrew } from "@/lib/db/crew-insights";
import { removeCrewMember } from "@/lib/db/crews";
import { expireCrew } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ crewId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const crew = await getCrew(crewId);
  if (crew?.createdBy === userId) throw new ApiError(409, "owner_cannot_leave", "The owner can't leave their own crew");
  await removeCrewMember(crewId, userId);
  expireCrew(crewId);
});
