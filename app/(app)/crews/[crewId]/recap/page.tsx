import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewRecap } from "@/lib/db/recap";
import { RecapSlides } from "@/components/recap/RecapSlides";

export default async function CrewRecapPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params;
  const session = await requireSession();

  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, crewId) });
  if (!group) notFound();

  const data = await getCrewRecap(crewId);

  return <RecapSlides crewId={crewId} crewName={group.name} data={data} />;
}
