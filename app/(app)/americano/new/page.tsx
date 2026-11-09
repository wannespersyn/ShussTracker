/**
 * New Americano / Mexicano — Route: /americano/new?crewId=
 *
 * Loads the crew roster (with Elo, for the player chips) and renders the
 * RotationSetup form. Requires crew membership.
 */
import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewInsights } from "@/lib/db/crew-insights";
import { RotationSetup } from "@/components/rotation/RotationSetup";

export default async function NewRotationPage({ searchParams }: Readonly<{ searchParams: Promise<{ crewId?: string }> }>) {
  const session = await requireSession();
  const { crewId } = await searchParams;
  if (!crewId) notFound();
  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }
  const insights = await getCrewInsights(crewId);
  // Most active first, so the usual suspects are at the top.
  const roster = [...insights.players]
    .sort((a, b) => b.games - a.games)
    .map((p) => ({ id: p.userId, name: p.name, elo: p.elo, games: p.games }));
  return <RotationSetup groupId={crewId} roster={roster} />;
}
