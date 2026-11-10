/**
 * POST /api/v1/rotations/[rotationId]/finish
 *
 * Ends an Americano / Mexicano early (organizer: whoever started it or the
 * crew owner). Played games keep counting.
 */
import { api, notFound } from "@/lib/api/http";
import { requireApiUser } from "@/lib/api/session";
import { finishRotationAs } from "@/lib/services/rotations";

type Ctx = { params: Promise<{ rotationId: string }> };

export const POST = api<Ctx>(async (req, { params }) => {
  const userId = await requireApiUser(req);
  const { rotationId } = await params;
  try {
    await finishRotationAs(userId, rotationId);
  } catch (e) {
    if ((e as Error).message === "Tournament not found") throw notFound();
    throw e;
  }
});
