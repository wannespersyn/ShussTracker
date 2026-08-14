import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { Card, LinkButton, PrimaryButton } from "@/components/ui";
import { createCrew } from "./actions";
import { ChevronRightIcon } from "@/components/ui/icons";

export default async function CrewsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: { with: { members: true } } },
  });

  const crews = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    inviteCode: m.group.inviteCode,
    memberCount: m.group.members.length,
  }));

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header>
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
          Your crews
        </div>
        <div className="font-display text-display-sm text-cream mt-1">Crews</div>
      </header>

      {crews.length === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">No crew yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            Start one below, or join a crewmate&apos;s with their code.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {crews.map((c) => (
            <Link key={c.id} href={`/crews/${c.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="font-display text-xl text-cream">{c.name}</div>
                  <div className="font-body text-body-sm text-cream/50">
                    {c.memberCount} {c.memberCount === 1 ? "member" : "members"} · code {c.inviteCode}
                  </div>
                </div>
                <div className="font-display text-2xl text-gold/70"><ChevronRightIcon className="w-6 h-6" /></div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <form action={createCrew} className="flex flex-col gap-2.5">
        <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/40">
          Start a new crew
        </div>
        <input
          type="text"
          name="name"
          required
          placeholder="Crew name"
          className="h-13 rounded-lg bg-cream/8 px-4 font-body text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
        />
        <PrimaryButton type="submit" variant="outline">
          Create crew
        </PrimaryButton>
      </form>

      <LinkButton href="/crews/join" variant="ghost">
        Got a crew code? Join with it
      </LinkButton>
    </div>
  );
}
