import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getEventDetail } from "@/lib/db/events";
import { BackButton, Card, LinkButton } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const event = await getEventDetail(eventId);
  if (!event) notFound();

  if (event.groupId) {
    try {
      await requireGroupMember(userId, event.groupId);
    } catch {
      notFound();
    }
  }

  const dateLabel = new Date(event.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const playerCount = new Set(event.standings.flatMap((s) => s.userIds)).size;

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-30">
      <div className="px-5 pt-3.5 pb-4.5 bg-gradient-alt border-b border-gold/16">
        <BackButton href={event.groupId ? `/crews/${event.groupId}` : "/home"} className="mb-4" />
        <div className="font-mono font-medium text-[10.5px] tracking-[0.08em] text-cream/50 truncate uppercase">
          {event.groupName ?? "Game night"}
        </div>
        <div className="font-display text-[32px] leading-[1.02] text-cream mt-2 truncate">{event.name}</div>
        <div className="font-mono font-medium text-[10.5px] tracking-[0.08em] text-cream/55 mt-2.25 uppercase">
          {dateLabel}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-ink/50 rounded-md px-3 py-2.75">
            <div className="font-mono font-semibold text-lg text-gold">{event.games.length}</div>
            <div className="font-heading font-medium text-[9px] tracking-widest text-cream/45 uppercase mt-1.25">
              Games
            </div>
          </div>
          <div className="bg-ink/50 rounded-md px-3 py-2.75">
            <div className="font-mono font-semibold text-lg text-cream">{playerCount}</div>
            <div className="font-heading font-medium text-[9px] tracking-widest text-cream/45 uppercase mt-1.25">
              Players
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col px-5 pt-5 gap-6">
        {event.standings.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Standings
            </div>
            {event.standings.map((s, i) => (
              <div
                key={s.userIds.join("+")}
                className="flex items-center gap-3 rounded-lg bg-surface-deep border border-cream/6 px-3.5 py-3"
              >
                <div className={cn("font-mono font-semibold text-body w-6.5", i === 0 ? "text-gold" : "text-cream/40")}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 font-heading font-semibold text-body-sm text-cream truncate">
                  {s.names}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold text-body text-cream">{s.points}</div>
                  <div className="font-mono text-[10px] text-cream/40 mt-0.5">
                    {s.wins}-{s.losses}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {event.games.length === 0 ? (
          <Card variant="flat" className="text-center py-8">
            <div className="font-display text-2xl text-cream mb-1">No games yet tonight</div>
            <div className="font-body text-body-sm text-cream/55 max-w-70 mx-auto">
              Log the first game and it&apos;ll show up here.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">
              Games logged
            </div>
            {event.games.map((g) => (
              <Link key={g.id} href={`/game/${g.id}`}>
                <Card className="flex items-center justify-between border-cream/10">
                  <div>
                    <div className="font-heading font-semibold text-body-sm text-cream">
                      {g.teams.map((t) => t.playerNames.join(" & ")).join(" vs ")}
                    </div>
                    <div className="font-mono text-[10px] text-cream/45 mt-1">{g.matType}-PLAYER MAT</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {event.groupId && (
          <div className="flex flex-col gap-2.5 mt-auto">
            <LinkButton href={`/log?crewId=${event.groupId}&eventId=${event.id}`}>Log a game tonight</LinkButton>
            <div className="flex gap-2.5">
              <LinkButton href={`/chwazi?crewId=${event.groupId}`} variant="outline" className="flex-1">
                Pick teams
              </LinkButton>
              <LinkButton
                href={`/tournaments/new?crewId=${event.groupId}&eventId=${event.id}`}
                variant="outline"
                className="flex-1"
              >
                Tournament
              </LinkButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
