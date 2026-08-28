import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getGroupEvents } from "@/lib/db/events";
import { getGameForRematch } from "@/lib/db/games";
import { LogGameWizard } from "@/components/log/LogGameWizard";
import { BackButton, Card } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons/ChevronRightIcon";
import { TEAM_COLORS, type Duo } from "@/lib/teams";
import { initialsFor } from "@/lib/format";

export default async function LogGamePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ crewId?: string; eventId?: string; teams?: string; casual?: string; rematch?: string }>;
}>) {
  const session = await requireSession();
  const { crewId, eventId, teams, casual, rematch } = await searchParams;

  // Rematch — same crew, same teams, fresh game. Self-contained: it skips
  // the crew/night picking below entirely since the original game already
  // pins down the crew, the event, and who's on which team.
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
        eventId={source.eventId ?? undefined}
        roster={rematchRoster}
        lockedTeams={lockedTeams}
        backHref={`/game/${rematch}`}
        trackShotZones={rematchGroup?.trackShotZones ?? false}
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
        <header className="flex items-center gap-3.5">
          <BackButton href="/home" />
          <div>
            <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
              New game
            </div>
            <div className="font-display text-display-sm text-cream mt-1">Which crew?</div>
          </div>
        </header>
        <div className="flex flex-col gap-3">
          {memberships.map((m) => {
            const eventQuery = eventId ? `&eventId=${eventId}` : "";
            return (
              <Link key={m.groupId} href={`/log?crewId=${m.groupId}${eventQuery}${teamsQuery}`}>
                <Card className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-xl text-cream">{m.group.name}</div>
                    <div className="font-body text-body-sm text-cream/50">
                      {m.group.members.length} {m.group.members.length === 1 ? "member" : "members"}
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

  // A crew with game nights on record gets asked which one this game
  // belongs to — "casual" explicitly skips straight to the wizard. Also
  // doubles as where the wizard's own back button returns to.
  const events = await getGroupEvents(selected.groupId);
  const nightPickerHref = `/log?crewId=${selected.groupId}`;
  const crewPickerHref = memberships.length > 1 ? "/log" : "/home";

  if (!eventId && !casual) {
    if (events.length > 0) {
      return (
        <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
          <header className="flex items-center gap-3.5">
            <BackButton href={crewPickerHref} />
            <div>
              <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45">
                New game
              </div>
              <div className="font-display text-display-sm text-cream mt-1">Which night?</div>
            </div>
          </header>
          <div className="flex flex-col gap-3">
            <Link href={`/log?crewId=${selected.groupId}&casual=1${teamsQuery}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <div className="font-display text-xl text-cream">Casual game</div>
                  <div className="font-body text-body-sm text-cream/50">Not part of a crew night</div>
                </div>
                <div className="font-display text-2xl text-gold/70"><ChevronRightIcon className="w-6 h-6" /></div>
              </Card>
            </Link>
            {events.slice(0, 5).map((e) => {
              const d = new Date(e.date);
              return (
                <Link key={e.id} href={`/log?crewId=${selected.groupId}&eventId=${e.id}${teamsQuery}`}>
                  <Card className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-xl text-cream">{e.name}</div>
                      <div className="font-body text-body-sm text-cream/50">
                        {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                        {e.gamesCount} {e.gamesCount === 1 ? "game" : "games"}
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
  }

  const [members, group] = await Promise.all([
    db.query.groupMembers.findMany({
      where: eq(groupMembers.groupId, selected.groupId),
      with: { user: true },
    }),
    db.query.groups.findFirst({ where: eq(groups.id, selected.groupId) }),
  ]);

  const roster = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? "Player",
  }));

  // The wizard's back button should retrace whichever screen led here: the
  // night picker if the crew has nights on record, otherwise straight back
  // to the crew picker (or home, for a single-crew user).
  const wizardBackHref = events.length > 0 ? nightPickerHref : crewPickerHref;

  return (
    <LogGameWizard
      groupId={selected.groupId}
      eventId={eventId}
      roster={roster}
      presetPlayerIds={presetPlayerIds}
      backHref={wizardBackHref}
      trackShotZones={group?.trackShotZones ?? false}
    />
  );
}
