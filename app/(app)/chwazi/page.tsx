import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { getCrewEloLeaderboard } from "@/lib/db/crews";
import { ChwaziPicker } from "@/components/chwazi/ChwaziPicker";
import { Card } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";


export default async function ChwaziPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ crewId?: string; count?: string }> }>) {
  const session = await requireSession();
  const t = await getT();
  const { crewId, count } = await searchParams;
  const requiredCount = count ? Number(count) : undefined;

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, session.user.id),
    with: { group: { with: { members: true } } },
  });

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="font-display text-3xl text-cream">{t.more.noCrew}</div>
        <div className="font-body text-body text-muted max-w-70">
          {t.empty.chwaziNoCrew}
        </div>
      </div>
    );
  }

  const selected = memberships.length === 1 ? memberships[0] : memberships.find((m) => m.groupId === crewId);

  if (!selected) {
    const countQuery = count ? `&count=${count}` : "";
    return (
      <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
        <header>
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-muted">
            Chwazi
          </div>
          <div className="font-display text-display-sm text-cream mt-1">{t.more.whichCrew}</div>
        </header>
        <div className="flex flex-col gap-3">
          {memberships.map((m) => (
            <Link key={m.groupId} href={`/chwazi?crewId=${m.groupId}${countQuery}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="font-display text-xl text-cream">{m.group.name}</div>
                  <div className="font-body text-body-sm text-muted">
                    {format(m.group.members.length === 1 ? t.more.member : t.more.members, { n: m.group.members.length })}
                  </div>
                </div>
                <ChevronRightIcon className="w-6 h-6 text-gold/70" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [members, elo] = await Promise.all([
    db.query.groupMembers.findMany({
      where: eq(groupMembers.groupId, selected.groupId),
      with: { user: true },
    }),
    getCrewEloLeaderboard(selected.groupId),
  ]);
  const roster = members.map((m) => ({ id: m.user.id, name: m.user.name ?? t.more.player }));
  const ratings = Object.fromEntries(elo.map((e) => [e.userId, e.rating]));
  roster.sort((x, y) => (ratings[y.id] ?? 0) - (ratings[x.id] ?? 0));

  return (
    <ChwaziPicker
      groupId={selected.groupId}
      roster={roster}
      ratings={ratings}
      requiredCount={requiredCount}
    />
  );
}
