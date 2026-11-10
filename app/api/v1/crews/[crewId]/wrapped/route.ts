/**
 * GET /api/v1/crews/[crewId]/wrapped
 *
 * Shussapp Wrapped (beta) for the signed-in player in this crew and the
 * current season: `{ ready: true, data }` or `{ ready: false, games, need }`.
 * 403 `beta_off` when the player hasn't got Wrapped switched on.
 */
import { api, ApiError, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { requireGroupMember } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import { getCrew } from "@/lib/db/crew-insights";
import { getWrapped } from "@/lib/db/wrapped";

type Ctx = { params: Promise<{ crewId: string }> };

export const GET = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { crewId } = await params;
  await requireGroupMember(userId, crewId);
  if (!(await hasBeta(userId, "wrapped"))) throw new ApiError(403, "beta_off", "Wrapped is a beta feature");
  const crew = await getCrew(crewId);
  if (!crew) throw notFound();
  return getWrapped(userId, { id: crew.id, name: crew.name });
});
