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

export const metadata = { title: "Camera live · Shussapp" };

export default async function CameraLivePage() {
  const session = await requireSession();
  if (!(await hasBeta(session.user.id, "camera"))) redirect("/settings/beta/camera");
  return <CameraLive />;
}
