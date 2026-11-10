/**
 * GET /api/v1/crews/[crewId]/events
 *
 * All of a crew's tournaments — brackets and Americano / Mexicano —
 * newest first, live ones flagged, finished ones with the winner. Members only.
 */
import { api } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { getCrewEvents } from "@/lib/db/crew-events";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  return { events: await getCrewEvents(crewId) };
});
