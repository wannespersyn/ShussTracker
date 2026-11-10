/**
 * Camera live (beta) — Route: /camera/live
 *
 * Live shot tracking with the phone fixed above the mat (CameraLive).
 * Only for players who switched the "camera" beta feature on.
 */
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import { CameraLive } from "@/components/camera/CameraLive";
import { getActiveCrew } from "@/lib/active-crew";

export const metadata = { title: "Camera live · Shussapp" };

export default async function CameraLivePage() {
  const session = await requireSession();
  if (!(await hasBeta(session.user.id, "camera"))) redirect("/settings/beta/camera");
  const { crews, crew } = await getActiveCrew(session.user.id);
  return <CameraLive crews={crews.map((c) => ({ id: c.id, name: c.name }))} initialCrewId={crew?.id} />;
}
