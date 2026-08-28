import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { BackButton } from "@/components/ui";
import { PinRivalryForm } from "@/components/crews/PinRivalryForm";
import { pinRivalryAction } from "../actions";

export default async function NewRivalryPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params;
  const session = await requireSession();

  try {
    await requireGroupMember(session.user.id, crewId);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, crewId) });
  if (!group) notFound();

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, crewId),
    with: { user: true },
  });
  const roster = members.map((m) => ({ id: m.user.id, name: m.user.name ?? "Player" }));

  const action = pinRivalryAction.bind(null, crewId);

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${crewId}`} />
        <div>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            {group.name}
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Pin a beef</div>
        </div>
      </header>
      <PinRivalryForm roster={roster} action={action} />
    </div>
  );
}
