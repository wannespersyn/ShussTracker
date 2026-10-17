import { notFound } from "next/navigation";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrew, getCrewInsights } from "@/lib/db/crew-insights";
import { getCrewRecap } from "@/lib/db/recap";
import { buildMonthlyRecap } from "@/lib/monthly-recap";
import { MonthlyRecap } from "@/components/recap/MonthlyRecap";
import { RecapSlides } from "@/components/recap/RecapSlides";

export default async function CrewRecapPage({ params }: Readonly<{ params: Promise<{ crewId: string }> }>) {
  const { crewId } = await params;
  const session = await requireSession();
  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }
  const group = await getCrew(crewId);
  if (!group) notFound();

  const insights = await getCrewInsights(crewId);
  const recap = buildMonthlyRecap(insights, session.user.id, group.name, new Date());
  if (recap) return <MonthlyRecap slides={recap.slides} crewName={group.name} closeHref={`/players/${session.user.id}`} />;

  // Viewer hasn't played lately: fall back to the crew season recap.
  const data = await getCrewRecap(crewId);
  return <RecapSlides crewId={crewId} crewName={group.name} data={data} />;
}
