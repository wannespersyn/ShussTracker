import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { requireGroupMember, requireSession } from "@/lib/db/authz";
import { getCrewBestDuo, getCrewEloLeaderboard, getCrewLeaderboard, getCrewRedZoneLeaderboard } from "@/lib/db/crews";
import { getCrewRivalries } from "@/lib/db/rivalries";
import { unpinRivalryAction } from "./rivalries/actions";
import { getCrewGuests } from "@/lib/db/guests";
import { addGuestAction, removeGuestAction } from "./guests/actions";
import { initialsFor } from "@/lib/format";
import { getGroupEvents } from "@/lib/db/events";
import { getGroupTournaments } from "@/lib/db/tournaments";
import { AvatarChip, BackButton, Card, ConfirmForm } from "@/components/ui";
import { CrewLeaderboard } from "@/components/crews/CrewLeaderboard";
import { SettingsIcon, ChevronRightIcon, ClockIcon, TrophyIcon, PlusIcon } from "@/components/ui/icons";
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

  const [season, tonight, redZone, elo, events, tournamentList, bestDuo, rivalries, guests] = await Promise.all([
    getCrewLeaderboard(crewId),
    getCrewLeaderboard(crewId, { onlyToday: true }),
    getCrewRedZoneLeaderboard(crewId),
    getCrewEloLeaderboard(crewId),
    getGroupEvents(crewId),
    getGroupTournaments(crewId),
    getCrewBestDuo(crewId),
    getCrewRivalries(crewId),
    getCrewGuests(crewId),
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
          <div className="flex items-center gap-2">
            <Link
              href={`/crews/${crewId}/feed`}
              aria-label="Activity feed"
              className="w-9.5 h-9.5 rounded-md bg-ink/40 flex items-center justify-center text-cream"
            >
              <ClockIcon className="w-4.5 h-4.5" />
            </Link>
            <Link
              href={`/tournaments/new?crewId=${crewId}`}
              aria-label="Start a tournament"
              className="w-9.5 h-9.5 rounded-md bg-ink/40 flex items-center justify-center text-cream"
            >
              <TrophyIcon className="w-4.5 h-4.5" />
            </Link>
            <Link
              href={`/log?crewId=${crewId}`}
              aria-label="Log a game"
              className="w-9.5 h-9.5 rounded-md bg-gold flex items-center justify-center text-ink"
            >
              <PlusIcon className="w-4.5 h-4.5" />
            </Link>
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
              Tap + up top to log your crew&apos;s first game — the leaderboard fills in here.
            </div>
          </Card>
        ) : (
          <>
            <CrewLeaderboard currentUserId={userId} season={season} tonight={tonight} redZone={redZone} elo={elo} />

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

        {/* <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Rivalries
            </div>
            <Link href={`/crews/${crewId}/rivalries/new`} className="font-body text-body-sm text-gold">
              Pin a beef
            </Link>
          </div>
          {rivalries.length === 0 ? (
            <div className="font-body text-body-sm text-cream/45">
              Nobody&apos;s pinned a beef yet — start one to track the running score.
            </div>
          ) : (
            rivalries.map((r) => {
              const total = r.totalMeetings;
              const aPct = total > 0 ? Math.round((r.aWins * 100) / total) : 50;
              const unpinAction = unpinRivalryAction.bind(null, r.id);
              const canUnpin = r.createdBy === userId || isOwner;
              return (
                <Card key={r.id} variant="flat" className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-heading font-semibold text-body text-cream truncate">
                      {r.aLabel} <span className="text-cream/35">vs</span> {r.bLabel}
                    </div>
                    {canUnpin && (
                      <ConfirmForm
                        action={unpinAction}
                        confirmMessage={`Unpin ${r.aLabel} vs ${r.bLabel}?`}
                        className="shrink-0"
                      >
                        <button type="submit" className="font-heading font-bold text-[11px] tracking-[1.2px] uppercase text-cream/35">
                          Unpin
                        </button>
                      </ConfirmForm>
                    )}
                  </div>
                  {total === 0 ? (
                    <div className="font-body text-[12.5px] text-cream/45">Haven&apos;t faced off yet.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between font-mono font-semibold text-lg text-cream">
                        <span>{r.aWins}</span>
                        <span className="font-body text-[12.5px] text-cream/35">{total} meetings</span>
                        <span>{r.bWins}</span>
                      </div>
                      <div className="h-2 rounded-pill bg-cream/8 overflow-hidden flex">
                        <div className="h-full bg-gold" style={{ width: `${aPct}%` }} />
                        <div className="h-full bg-red" style={{ width: `${100 - aPct}%` }} />
                      </div>
                      {r.insight && (
                        <div className="flex items-center gap-2">
                          {r.insight.extended && (
                            <span className="shrink-0 font-mono font-semibold text-[9px] tracking-[0.08em] text-ink bg-gold rounded-pill px-2 py-1">
                              LEAD EXTENDED
                            </span>
                          )}
                          <div className="font-body text-[12.5px] leading-snug text-cream/60">{r.insight.text}</div>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              );
            })
          )}
        </div> */}

        <div className="flex flex-col gap-2.5">
          <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
            Guest players
          </div>
          {guests.length > 0 && (
            <div className="flex flex-col gap-2">
              {guests.map((g) => {
                const removeAction = removeGuestAction.bind(null, crewId, g.id);
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-xl bg-cream/5 border border-cream/10 px-3.5 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-body font-semibold text-[15px] text-cream truncate">{g.name}</div>
                      <div className="font-mono text-[10px] text-cream/40 mt-0.5">
                        Claim code: <span className="text-gold tracking-[2px]">{g.claimToken}</span>
                      </div>
                    </div>
                    {isOwner && (
                      <ConfirmForm action={removeAction} confirmMessage={`Remove guest ${g.name}?`}>
                        <button type="submit" className="font-heading font-bold text-[11px] tracking-[1.2px] uppercase text-red-pale">
                          Remove
                        </button>
                      </ConfirmForm>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <form action={addGuestAction.bind(null, crewId)} className="flex gap-2">
            <input
              type="text"
              name="name"
              required
              placeholder="Guest's name"
              className="flex-1 h-12 rounded-md bg-cream/8 px-3.5 font-body text-[14px] text-cream placeholder:text-cream/40 outline-none border-2 border-transparent focus:border-gold/40"
            />
            <button type="submit" className="h-12 px-4 rounded-md bg-gold font-heading font-bold text-sm text-ink">
              Add
            </button>
          </form>
          <div className="font-body text-[12px] text-cream/40">
            Guests can be picked into games like anyone else. Hand them their claim code once they&apos;re ready to
            sign up for real — <span className="text-cream/55">/claim</span> folds their history into their new account.
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
            Tournaments
          </div>
          {activeTournaments.length === 0 ? (
            <div className="font-body text-body-sm text-cream/45">Nothing running right now.</div>
          ) : (
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
          )}
        </div>

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
