/**
 * DELETE /api/v1/crews/[crewId]/members/[userId]
 *
 * Owner only: removes a member from the crew. An unclaimed guest who never
 * played is deleted entirely (see removeGuestPlayer), like "Remove" on the
 * website's guest list.
 * The owner can't remove themselves (409) — they delete the crew instead.
 */
import { eq } from "drizzle-orm";
import { ApiError, api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireGroupMember, requireGroupOwner } from "@/lib/db/authz";
import { removeCrewMember } from "@/lib/db/crews";
import { removeGuestPlayer } from "@/lib/db/guests";
import { expireCrew } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ crewId: string; userId: string }> };

export const DELETE = api<Ctx>(async (req, { params }) => {
  const ownerId = await requireApiUser(req);
  const { crewId, userId } = await params;
  await requireGroupOwner(ownerId, crewId);
  if (userId === ownerId) throw new ApiError(409, "owner_cannot_leave", "The owner can't remove themselves");
  await requireGroupMember(userId, crewId).catch(() => {
    throw notFound();
  });
  const member = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isGuest: true, claimToken: true } });
  if (member?.isGuest && member.claimToken) await removeGuestPlayer(crewId, userId);
  else await removeCrewMember(crewId, userId);
  expireCrew(crewId);
});
