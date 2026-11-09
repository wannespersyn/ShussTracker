/**
 * Manage an Americano — Route: /americano/[rotationId]/manage
 *
 * For whoever started it or the crew owner, while it's running: mats,
 * rounds, line-up and standings order (RotationManage).
 */
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getRotation } from "@/lib/db/rotations";
import { rotationProgress } from "@/lib/rotation-view";
import { RotationManage } from "@/components/rotation/RotationManage";

export default async function ManageRotationPage({ params }: Readonly<{ params: Promise<{ rotationId: string }> }>) {
  const { rotationId } = await params;
  const session = await requireSession();
  const userId = session.user.id;
  const rotation = await getRotation(rotationId);
  if (!rotation) notFound();
  try {
    await requireGroupMember(userId, rotation.groupId);
  } catch {
    notFound();
  }
  const [crew, members] = await Promise.all([
    db.query.groups.findFirst({ where: eq(groups.id, rotation.groupId), columns: { createdBy: true } }),
    db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, rotation.groupId), with: { user: { columns: { id: true, name: true } } } }),
  ]);
  if (rotation.createdBy !== userId && crew?.createdBy !== userId) notFound();
  if (rotation.status === "completed") redirect(`/americano/${rotationId}`);

  return (
    <RotationManage
      rotationId={rotation.id}
      mode={rotation.mode}
      mats={rotation.mats}
      rounds={rotation.rounds}
      currentRound={rotationProgress(rotation).current}
      players={rotation.players}
      crew={members.map((m) => ({ id: m.user.id, name: m.user.name ?? "Player" }))}
      tiebreaks={rotation.tiebreaks}
    />
  );
}
