/**
 * Camera viewer — Route: /camera/view/[sessionId]
 *
 * Follow (and correct) a crew member's live camera from your own phone.
 * Open to everyone in that crew.
 */
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/db/authz";
import { getCameraState } from "@/lib/db/camera";
import { getCrew } from "@/lib/db/crew-insights";
import { CameraViewer } from "@/components/camera/CameraViewer";

export const metadata = { title: "Camera live · Shussapp" };

export default async function CameraViewPage({ params }: Readonly<{ params: Promise<{ sessionId: string }> }>) {
  const session = await requireSession();
  const { sessionId } = await params;
  const state = await getCameraState(session.user.id, sessionId).catch(() => null);
  if (!state) notFound();
  const crew = await getCrew(state.groupId);
  return <CameraViewer initial={state} crewName={crew?.name ?? ""} />;
}
