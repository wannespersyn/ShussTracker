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
  // Only "no such session / not your crew" is a 404; anything else (say, the
  // database not migrated) is a real error and must show as one.
  const state = await getCameraState(session.user.id, sessionId).catch((err: unknown) => {
    if (err instanceof Error && err.message === "Not found") return null;
    throw err;
  });
  if (!state) notFound();
  const crew = await getCrew(state.groupId);
  return <CameraViewer initial={state} crewName={crew?.name ?? ""} />;
}
