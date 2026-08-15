import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { TournamentSetup } from "@/components/tournaments/TournamentSetup";

export default async function NewTournamentPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ crewId?: string; eventId?: string; entrants?: string }> }>) {
  const session = await requireSession();
  const { crewId, eventId, entrants } = await searchParams;
  if (!crewId) notFound();

  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, crewId),
    with: { user: true },
  });
  const roster = members.map((m) => ({ id: m.user.id, name: m.user.name ?? "Player" }));
  const presetEntrantIds = entrants ? entrants.split(",").filter(Boolean) : undefined;

  return <TournamentSetup groupId={crewId} eventId={eventId} roster={roster} presetEntrantIds={presetEntrantIds} />;
}
