import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewBestDuo, getCrewLeaderboard, getCrewRedZoneLeaderboard } from "@/lib/db/crews";
import { initialsFor } from "@/lib/format";
import { getGroupEvents } from "@/lib/db/events";
import { getGroupTournaments } from "@/lib/db/tournaments";
import { AvatarChip, BackButton, Card, ConfirmForm, LinkButton } from "@/components/ui";
import { CrewLeaderboard } from "@/components/crews/CrewLeaderboard";
import { SettingsIcon, ChevronRightIcon } from "@/components/ui/icons";
import { leaveCrew, createEventAction } from "@/app/(app)/crews/actions";

const TOURNAMENT_FORMAT_LABEL = { single_elim: "Single elim", double_elim: "Double elim", round_robin: "Round robin" } as const;

export default async function CrewPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  try {
    await requireGroupMember(userId, crewId);
  } catch {
    notFound();
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, crewId) });
  if (!group) notFound();

  const isOwner = group.createdBy === userId;
  const leaveAction = leaveCrew.bind(null, crewId);

  const [season, tonight, redZone, events, tournamentList, bestDuo] = await Promise.all([
    getCrewLeaderboard(crewId),
    getCrewLeaderboard(crewId, { onlyToday: true }),
    getCrewRedZoneLeaderboard(crewId),
    getGroupEvents(crewId),
    getGroupTournaments(crewId),
    getCrewBestDuo(crewId),
  ]);
  const hasGames = season.some((m) => m.gamesPlayed > 0);
  const startTonightAction = createEventAction.bind(null, crewId);
  const activeTournaments = tournamentList.filter((t) => t.status !== "completed");
  const totalMamaHits = redZone.reduce((sum, r) => sum + r.chugs, 0);
  const ownEntry = season.find((m) => m.userId === userId);
  const ownRank = ownEntry ? season.indexOf(ownEntry) + 1 : null;
  const ownWinRate = ownEntry && ownEntry.gamesPlayed > 0 ? Math.round((ownEntry.wins / ownEntry.gamesPlayed) * 100) : null;
  const duoTotal = bestDuo ? bestDuo.wins + bestDuo.losses : 0;

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-30">
      <div className="relative px-5 pt-3.5 pb-5 bg-gradient-alt border-b border-gold/16">
        <div className="flex items-center justify-between mb-4">
          <BackButton href="/crews" />
          {isOwner && (
            <Link
              href={`/crews/${crewId}/manage`}
              aria-label="Manage crew"
              className="w-9.5 h-9.5 rounded-md bg-ink/40 flex items-center justify-center text-cream"
            >
              <SettingsIcon className="w-4.5 h-4.5" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="w-15 h-15 rounded-lg bg-gold flex items-center justify-center font-display text-2xl text-ink shrink-0">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display text-[28px] leading-[1.02] text-cream truncate">{group.name}</div>
            <div className="font-mono font-medium text-[10.5px] tracking-[0.08em] text-cream/50 mt-1.5">
              {season.length} {season.length === 1 ? "MEMBER" : "MEMBERS"} · CODE {group.inviteCode}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.75 mt-4.5">
          <div className="bg-ink/50 rounded-md px-2.5 py-2.75">
            <div className="font-mono font-semibold text-base text-gold">{events.length}</div>
            <div className="font-heading font-medium text-[8.5px] tracking-widest text-cream/45 uppercase mt-1.25">
              Nights
            </div>
          </div>
          <div className="bg-ink/50 rounded-md px-2.5 py-2.75">
            <div className="font-mono font-semibold text-base text-red-bright">{totalMamaHits}</div>
            <div className="font-heading font-medium text-[8.5px] tracking-widest text-cream/45 uppercase mt-1.25">
              Mama hits
            </div>
          </div>
          <div className="bg-ink/50 rounded-md px-2.5 py-2.75">
            <div className="font-mono font-semibold text-base text-cream">{ownWinRate !== null ? `${ownWinRate}%` : "–"}</div>
            <div className="font-heading font-medium text-[8.5px] tracking-widest text-cream/45 uppercase mt-1.25">
              Win rate
            </div>
          </div>
          <div className="bg-ink/50 rounded-md px-2.5 py-2.75">
            <div className="flex items-baseline gap-0.5">
              <span className="font-mono font-semibold text-base text-cream">{ownRank ? `#${ownRank}` : "–"}</span>
              {ownRank && <span className="font-mono text-[10px] text-cream/40">/{season.length}</span>}
            </div>
            <div className="font-heading font-medium text-[8.5px] tracking-widest text-cream/45 uppercase mt-1.25">
              Your rank
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col px-5 pt-5 gap-6">
        {!hasGames ? (
          <Card variant="flat" className="text-center py-8">
            <div className="font-display text-2xl text-cream mb-1">No games yet</div>
            <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
              Log your crew&apos;s first game and the leaderboard fills in here.
            </div>
          </Card>
        ) : (
          <>
            <CrewLeaderboard currentUserId={userId} season={season} tonight={tonight} redZone={redZone} />

            {bestDuo && duoTotal > 0 && (
              <Card variant="flat" className="flex items-center gap-3.5">
                <div className="flex -space-x-2">
                  <AvatarChip initials={initialsFor(bestDuo.aName)} ring="gold" size={34} />
                  <AvatarChip initials={initialsFor(bestDuo.bName)} ring="mint" size={34} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-semibold text-[10.5px] tracking-kicker uppercase text-cream/50">
                    Best partner
                  </div>
                  <div className="font-heading font-semibold text-heading text-cream leading-[1.2] mt-0.5 truncate">
                    {bestDuo.aName.split(" ")[0]} &amp; {bestDuo.bName.split(" ")[0]}
                  </div>
                  <div className="font-mono text-[10px] text-cream/42 mt-0.5">
                    {bestDuo.wins}-{bestDuo.losses} together
                  </div>
                </div>
                <div className="font-display text-2xl text-gold shrink-0">
                  {Math.round((bestDuo.wins / duoTotal) * 100)}%
                </div>
              </Card>
            )}
          </>
        )}

        {activeTournaments.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Tournaments in progress
            </div>
            <div className="flex flex-col gap-2">
              {activeTournaments.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <Card className="flex items-center justify-between border-cream/10">
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-body text-cream truncate">{t.name}</div>
                      <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40 mt-0.5">
                        {TOURNAMENT_FORMAT_LABEL[t.format]}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gold/70 shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <LinkButton href={`/chwazi?crewId=${crewId}`} variant="outline" className="flex-1">
            Pick teams
          </LinkButton>
          <LinkButton href={`/tournaments/new?crewId=${crewId}`} variant="outline" className="flex-1">
            Tournament
          </LinkButton>
        </div>

        <LinkButton href={`/log?crewId=${crewId}`}>Log a game with this crew</LinkButton>

        {(hasGames || !isOwner) && (
          <div className="flex items-center justify-center gap-5">
            {hasGames && (
              <Link
                href={`/crews/${crewId}/recap`}
                className="font-heading font-bold text-[11px] tracking-[1.2px] uppercase text-gold/70"
              >
                Season recap
              </Link>
            )}
            {!isOwner && (
              <ConfirmForm action={leaveAction} confirmMessage={`Leave ${group.name}?`}>
                <button
                  type="submit"
                  className="font-heading font-bold text-[11px] tracking-[1.2px] uppercase text-cream/35"
                >
                  Leave crew
                </button>
              </ConfirmForm>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
