import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { LogGameWizard } from "@/components/log/LogGameWizard";
import { Card } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/ui/icons/ArrowLeftIcon";

export default async function LogGamePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ crewId?: string }>;
}>) {
  const session = await requireSession();
  const { crewId } = await searchParams;

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, session.user.id),
    with: { group: { with: { members: true } } },
  });

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="font-display text-3xl text-cream">No crew yet</div>
        <div className="font-body text-body text-cream/55 max-w-70">
          Logging a game needs real crewmates on the mat. Join or start a crew first, then come back and flick.
        </div>
      </div>
    );
  }

  const selected =
    memberships.length === 1
      ? memberships[0]
      : memberships.find((m) => m.groupId === crewId);

  if (!selected) {
    // Multiple crews and none picked yet (or an unrecognized crewId) —
    // ask which one is playing instead of guessing.
    return (
      <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
        <header>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
            New game
          </div>
          <div className="font-display text-display-sm text-cream mt-1">Which crew?</div>
        </header>
        <div className="flex flex-col gap-3">
          {memberships.map((m) => (
            <Link key={m.groupId} href={`/log?crewId=${m.groupId}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="font-display text-xl text-cream">{m.group.name}</div>
                  <div className="font-body text-body-sm text-cream/50">
                    {m.group.members.length} {m.group.members.length === 1 ? "member" : "members"}
                  </div>
                </div>
                <div className="font-display text-2xl text-gold/70"><ArrowLeftIcon className="w-6 h-6 rotate-180" /></div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const members = await db.query.groupMembers.findMany({
    where: eq(groupMembers.groupId, selected.groupId),
    with: { user: true },
  });

  const roster = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? "Player",
  }));

  return <LogGameWizard groupId={selected.groupId} roster={roster} />;
}
