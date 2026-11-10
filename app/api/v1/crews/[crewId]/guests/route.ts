/**
 * POST /api/v1/crews/[crewId]/guests
 *
 * `{ name }` adds a guest player (no account yet) to the crew; any member
 * may do this. Returns `{ userId, claimToken }` so the app can share the
 * claim link right away.
 */
import { api, readJson, str } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { addGuestPlayer } from "@/lib/db/guests";
import { expireCrew } from "@/lib/cache-tags";

type Ctx = { params: Promise<{ crewId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  const name = str(await readJson(req), "name", 40);
  const guest = await addGuestPlayer(crewId, name);
  expireCrew(crewId);
  return Response.json(guest, { status: 201 });
});
