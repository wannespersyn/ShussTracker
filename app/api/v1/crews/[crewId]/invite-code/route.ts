/**
 * POST /api/v1/crews/[crewId]/invite-code
 *
 * Owner only: replaces the crew's invite code (the old one stops working).
 * Returns `{ inviteCode }`.
 */
import { api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupOwner } from "@/lib/db/authz";
import { regenerateInviteCode } from "@/lib/db/crews";

type Ctx = { params: Promise<{ crewId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupOwner(userId, crewId);
  return { inviteCode: await regenerateInviteCode(crewId) };
});
