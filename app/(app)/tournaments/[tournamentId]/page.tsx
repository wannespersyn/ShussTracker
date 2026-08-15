import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getTournament, type TournamentEntrantView } from "@/lib/db/tournaments";
import { BackButton, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function TournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const session = await requireSession();

  const tournament = await getTournament(tournamentId);
  if (!tournament) notFound();

  try {
    await requireGroupMember(session.user.id, tournament.groupId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 pt-14 pb-28 gap-6">
      <header className="flex items-center gap-3.5">
        <BackButton href={`/crews/${tournament.groupId}`} />
        <div className="min-w-0">
          <div className="font-heading font-bold text-label-kicker tracking-kicker uppercase text-cream/45 truncate">
            {tournament.groupName} · {tournament.status === "completed" ? "Final" : "In progress"}
          </div>
          <div className="font-display text-display-sm text-cream mt-1 truncate">{tournament.name}</div>
        </div>
      </header>

      {tournament.championEntrant && (
        <Card variant="hero" className="text-center py-6">
          <div className="font-mono font-medium text-[10.5px] tracking-widest uppercase text-gold/80">Champions</div>
          <div className="font-display text-2xl text-cream mt-1.5">{tournament.championEntrant.names}</div>
        </Card>
      )}

      <div className="flex flex-col gap-6">
        {tournament.matchesByRound.map((round, i) => {
          const isFinal = i === tournament.totalRounds - 1;
          return (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40">
                {isFinal ? "Final" : i === tournament.totalRounds - 2 ? "Semifinal" : `Round ${i + 1}`}
              </div>
              {round.map((m) => {
                const playable = m.entrantA && m.entrantB && !m.gameId;
                const content = (
                  <Card
                    variant={m.winnerEntrantId ? "gold" : "default"}
                    className={cn("flex flex-col gap-1.5", isFinal && !m.winnerEntrantId && "border-[1.5px] border-gold")}
                  >
                    <MatchSide entrant={m.entrantA} isWinner={m.winnerEntrantId === m.entrantA?.id} />
                    <div className="h-px bg-cream/10" />
                    <MatchSide entrant={m.entrantB} isWinner={m.winnerEntrantId === m.entrantB?.id} />
                  </Card>
                );
                return playable ? (
                  <Link key={m.id} href={`/tournaments/${tournament.id}/match/${m.id}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={m.id}>{content}</div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchSide({
  entrant,
  isWinner,
}: Readonly<{ entrant: TournamentEntrantView | null; isWinner: boolean }>) {
  return (
    <div className={cn("flex items-center justify-between", isWinner ? "text-gold" : "text-cream/70")}>
      <span className="font-heading font-semibold text-[15px] truncate">{entrant ? entrant.names : "TBD"}</span>
      {isWinner && <span className="shrink-0 font-mono font-semibold text-[10px] tracking-widest uppercase">Won</span>}
    </div>
  );
}
