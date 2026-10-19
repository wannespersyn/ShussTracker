import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getCrewInsights } from "@/lib/db/crew-insights";
import { getGameForRematch } from "@/lib/db/games";
import { LogGameWizard } from "@/components/log/LogGameWizard";
import { BackButton, Card } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons/ChevronRightIcon";
import { TEAM_COLORS, type Duo } from "@/lib/teams";
import { initialsFor } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { format } from "@/lib/i18n";

export default async function LogGamePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ crewId?: string; teams?: string; casual?: string; rematch?: string }>;
}>) {
  const session = await requireSession();
  const t = await getT();
  const { crewId, teams, casual, rematch } = await searchParams;

  // Rematch — same crew, same teams, fresh game. Self-contained: it skips
  // the crew/night picking below entirely since the original game already
  // pins down the crew, and who's on which team.
  if (rematch) {
    const source = await getGameForRematch(rematch);
    if (!source?.groupId) notFound();
    try {
      await requireGroupMember(session.user.id, source.groupId);
    } catch {
      notFound();
    }

    const rematchGroup = await db.query.groups.findFirst({ where: eq(groups.id, source.groupId) });

    const lockedTeams: Duo[] = source.teams.map((t, i) => {
      const ring = TEAM_COLORS[i % TEAM_COLORS.length];
      return {
        id: `team-${i}`,
        label: t.label,
        color: ring,
        players: t.players.map((p) => ({ id: p.id, name: p.name, initials: initialsFor(p.name), ring })),
      };
    });
    const rematchRoster = lockedTeams.flatMap((t) => t.players.map((p) => ({ id: p.id, name: p.name })));

    return (
      <LogGameWizard
        groupId={source.groupId}
        roster={rematchRoster}
        lockedTeams={lockedTeams}
        backHref={`/game/${rematch}`}
        trackShotZones={rematchGroup?.trackShotZones ?? false}
        crewName={rematchGroup?.name}
      />
    );
  }

  const presetPlayerIds = teams ? teams.split(",").filter(Boolean) : undefined;
  const teamsQuery = teams ? `&teams=${teams}` : "";

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, session.user.id),
    with: { group: { with: { members: true } } },
  });

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="font-display text-3xl text-cream">{t.more.noCrew}</div>
        <div className="font-body text-body text-muted max-w-70">
          {t.empty.logNoCrew}
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
        <header className="flex items-center gap-3.5">
          <BackButton href="/home" />
          <div>
            <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-muted">
              {t.more.newGame}
            </div>
            <div className="font-display text-display-sm text-cream mt-1">{t.more.whichCrew}</div>
          </div>
        </header>
        <div className="flex flex-col gap-3">
          {memberships.map((m) => {
            return (
              <Link key={m.groupId} href={`/log?crewId=${m.groupId}${teamsQuery}`}>
                <Card className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl text-cream">{m.group.name}</div>
                    <div className="font-body text-body-sm text-muted">
                      {format(m.group.members.length === 1 ? t.more.member : t.more.members, { n: m.group.members.length })}
                    </div>
                  </div>
                  <div className="font-display text-2xl text-gold/70"><ChevronRightIcon className="w-6 h-6" /></div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const crewPickerHref = memberships.length > 1 ? "/log" : "/home";

  const [members, group] = await Promise.all([
    db.query.groupMembers.findMany({
      where: eq(groupMembers.groupId, selected.groupId),
      with: { user: true },
    }),
    db.query.groups.findFirst({ where: eq(groups.id, selected.groupId) }),
  ]);

  const roster = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? t.more.player,
  }));

  const insights = await getCrewInsights(selected.groupId);
  const ratings = Object.fromEntries(insights.players.map((p) => [p.userId, p.elo]));
  const duoRecords = Object.fromEntries(insights.duos.map((d) => [[d.a.id, d.b.id].sort().join("|"), `${d.wins}–${d.losses}`]));
  const activity = new Map(insights.players.map((p) => [p.userId, p.games]));
  roster.sort((a, b) => (activity.get(b.id) ?? 0) - (activity.get(a.id) ?? 0));

  return (
    <LogGameWizard
      groupId={selected.groupId}
      roster={roster}
      presetPlayerIds={presetPlayerIds}
      backHref={crewPickerHref}
      trackShotZones={group?.trackShotZones ?? false}
      ratings={ratings}
      duoRecords={duoRecords}
      crewName={group?.name}
    />
  );
}
