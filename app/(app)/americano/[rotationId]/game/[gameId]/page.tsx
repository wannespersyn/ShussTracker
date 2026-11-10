/**
 * Americano game — Route: /americano/[rotationId]/game/[gameId]
 *
 * Opens the log wizard on the two planned duos of one rotation game (beta
 * users get the mat logger too). 404 when it's already played.
 */
import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getRotation } from "@/lib/db/rotations";
import { hasBeta } from "@/lib/db/beta";
import { RotationGamePlayer } from "@/components/rotation/RotationGamePlayer";

export default async function RotationGamePage({ params }: Readonly<{ params: Promise<{ rotationId: string; gameId: string }> }>) {
  const { rotationId, gameId } = await params;
  const session = await requireSession();
  const rotation = await getRotation(rotationId);
  if (!rotation) notFound();
  try {
    await requireGroupMember(session.user.id, rotation.groupId);
  } catch {
    notFound();
  }
  const g = rotation.games.find((x) => x.id === gameId);
  if (!g || g.played || rotation.status === "completed") notFound();

  const [start, celebrations, mat] = await Promise.all([
    hasBeta(session.user.id, "start"),
    hasBeta(session.user.id, "celebrations"),
    hasBeta(session.user.id, "mat"),
  ]);
  const name = new Map(rotation.players.map((p) => [p.id, p.name]));
  const side = (ids: readonly string[]) => ids.map((id) => ({ id, name: name.get(id) ?? "Player" })) as [{ id: string; name: string }, { id: string; name: string }];

  return (
    <RotationGamePlayer
      rotationId={rotation.id}
      rotationGameId={g.id}
      teamA={side(g.a)}
      teamB={side(g.b)}
      beta={{ start, celebrations, mat }}
    />
  );
}
