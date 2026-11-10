/**
 * Camera (beta) — Route: /camera
 *
 * Test page for shot tracking with the camera above the mat (CameraLab).
 * Only for players who switched the "camera" beta feature on.
 */
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { hasBeta } from "@/lib/db/beta";
import { CameraLab } from "@/components/camera/CameraLab";

export const metadata = { title: "Camera · Shussapp" };

export default async function CameraPage() {
  const session = await requireSession();
  if (!(await hasBeta(session.user.id, "camera"))) redirect("/settings/beta/camera");
  return <CameraLab />;
}
