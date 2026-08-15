import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers } from "@/lib/db/schema";
import { requireSession } from "@/lib/db/authz";
import { getCrewLeaderboard, type CrewLeaderboardEntry } from "@/lib/db/crews";
import { initialsFor } from "@/lib/format";
import type { CapRingColor } from "@/lib/theme/tokens";
import { AvatarChip, Card } from "@/components/ui";
import { CreateCrewSheet } from "@/components/crews/CreateCrewSheet";
import { ChevronRightIcon, SearchIcon } from "@/components/ui/icons";

const RING_CYCLE: CapRingColor[] = ["gold", "red", "mint", "cream"];

function crewSummary(userId: string, name: string, inviteCode: string, board: CrewLeaderboardEntry[]) {
  const ownEntry = board.find((m) => m.userId === userId);
  const ownRank = ownEntry ? board.indexOf(ownEntry) + 1 : null;
  const ownWinRate = ownEntry && ownEntry.gamesPlayed > 0 ? Math.round((ownEntry.wins / ownEntry.gamesPlayed) * 100) : null;
  return { name, inviteCode, memberCount: board.length, ownRank, ownWinRate, preview: board.slice(0, 4) };
}

export default async function CrewsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const memberships = await db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
    with: { group: { with: { members: true } } },
  });

  const boards = await Promise.all(memberships.map((m) => getCrewLeaderboard(m.groupId)));

  const crews = memberships.map((m, i) => ({
    id: m.group.id,
    ...crewSummary(userId, m.group.name, m.group.inviteCode, boards[i]),
  }));

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-3.5 pb-30 gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="font-display text-display-sm text-cream">Crews</div>
        <CreateCrewSheet />
      </header>

      <Link
        href="/crews/join"
        className="flex items-center gap-2.5 bg-surface-panel border border-cream/8 rounded-lg px-3.5 h-12"
      >
        <SearchIcon className="w-4 h-4 text-cream/40" />
        <span className="font-body text-sm text-cream/35">Find a crew or invite code</span>
      </Link>

      {crews.length === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <div className="font-display text-2xl text-cream mb-1">No crew yet</div>
          <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
            Tap + above to start one, or join a crewmate&apos;s with their code.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.75">
          {crews.map((c) => (
            <Link key={c.id} href={`/crews/${c.id}`}>
              <Card className="flex flex-col gap-3.25 border-cream/10">
                <div className="flex items-center gap-3.25">
                  <div className="w-11.5 h-11.5 rounded-md bg-gold flex items-center justify-center font-display text-lg text-ink shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold text-body text-cream truncate">{c.name}</div>
                    <div className="font-mono text-[10px] tracking-[0.06em] text-cream/42 mt-1">
                      {c.memberCount} {c.memberCount === 1 ? "MEMBER" : "MEMBERS"} · CODE {c.inviteCode}
                    </div>
                  </div>
                  {c.ownRank && (
                    <span className="font-mono font-semibold text-[10px] tracking-[0.08em] text-gold bg-gold/15 rounded-pill px-2.25 py-1.25 shrink-0">
                      #{c.ownRank} OF {c.memberCount}
                    </span>
                  )}
                  <ChevronRightIcon className="w-5 h-5 text-cream/35 shrink-0" />
                </div>
                {c.preview.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1.75">
                      {c.preview.map((m, i) => (
                        <AvatarChip
                          key={m.userId}
                          initials={initialsFor(m.name)}
                          ring={RING_CYCLE[i % RING_CYCLE.length]}
                          size={26}
                        />
                      ))}
                    </div>
                    {c.ownWinRate !== null && (
                      <span className="font-mono text-[10.5px] text-cream/45">Your win rate {c.ownWinRate}%</span>
                    )}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
