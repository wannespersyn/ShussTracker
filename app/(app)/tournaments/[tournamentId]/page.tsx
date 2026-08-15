import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { getTournament, type TournamentEntrantView, type TournamentMatchView } from "@/lib/db/tournaments";
import { BackButton, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

const FORMAT_LABEL = { single_elim: "Single elimination", double_elim: "Double elimination", round_robin: "Round robin" } as const;

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
            {tournament.groupName} · {tournament.status === "completed" ? "Final" : "In progress"} · {FORMAT_LABEL[tournament.format]}
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

      {tournament.format === "round_robin" && (
        <>
          <Standings standings={tournament.standings} />
          <RoundsSection title="Schedule" rounds={tournament.roundRobinRounds} tournamentId={tournament.id} labelFor={(i) => `Round ${i + 1}`} />
        </>
      )}

      {tournament.format === "single_elim" && (
        <RoundsSection
          title="Bracket"
          rounds={tournament.winnersRounds}
          tournamentId={tournament.id}
          labelFor={(i, total) => (i === total - 1 ? "Final" : i === total - 2 ? "Semifinal" : `Round ${i + 1}`)}
        />
      )}

      {tournament.format === "double_elim" && (
        <>
          <RoundsSection
            title="Winners bracket"
            rounds={tournament.winnersRounds}
            tournamentId={tournament.id}
            labelFor={(i, total) => (i === total - 1 ? "Winners final" : `Round ${i + 1}`)}
          />
          <RoundsSection
            title="Losers bracket"
            rounds={tournament.losersRounds}
            tournamentId={tournament.id}
            labelFor={(i, total) => (i === total - 1 ? "Losers final" : `Round ${i + 1}`)}
          />
          {tournament.grandFinal && (
            <div className="flex flex-col gap-2.5">
              <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40">Grand final</div>
              <MatchCard match={tournament.grandFinal} tournamentId={tournament.id} highlight />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Standings({
  standings,
}: Readonly<{ standings: { entrant: TournamentEntrantView; wins: number; played: number }[] }>) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40">Standings</div>
      <Card className="flex flex-col gap-2.5">
        {standings.map((row, i) => (
          <div key={row.entrant.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono font-semibold text-sm text-cream/45 w-4 shrink-0">{i + 1}</span>
              <span className="font-heading font-semibold text-[15px] text-cream truncate">{row.entrant.names}</span>
            </div>
            <span className="font-mono font-semibold text-[13px] text-gold shrink-0">
              {row.wins}-{row.played - row.wins}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function RoundsSection({
  title,
  rounds,
  tournamentId,
  labelFor,
}: Readonly<{
  title: string;
  rounds: TournamentMatchView[][];
  tournamentId: string;
  labelFor: (i: number, total: number) => string;
}>) {
  if (rounds.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      <div className="font-heading font-semibold text-[12px] tracking-kicker uppercase text-cream/55">{title}</div>
      {rounds.map((round, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <div className="font-mono font-medium text-[10px] tracking-widest uppercase text-cream/40">
            {labelFor(i, rounds.length)}
          </div>
          {round.map((m) => (
            <MatchCard key={m.id} match={m} tournamentId={tournamentId} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match: m,
  tournamentId,
  highlight = false,
}: Readonly<{ match: TournamentMatchView; tournamentId: string; highlight?: boolean }>) {
  const playable = m.entrantA && m.entrantB && !m.gameId;
  const content = (
    <Card
      variant={m.winnerEntrantId ? "gold" : "default"}
      className={cn("flex flex-col gap-1.5", highlight && !m.winnerEntrantId && "border-[1.5px] border-gold")}
    >
      <MatchSide entrant={m.entrantA} isWinner={m.winnerEntrantId === m.entrantA?.id} />
      <div className="h-px bg-cream/10" />
      <MatchSide entrant={m.entrantB} isWinner={m.winnerEntrantId === m.entrantB?.id} />
    </Card>
  );
  return playable ? (
    <Link href={`/tournaments/${tournamentId}/match/${m.id}`}>{content}</Link>
  ) : (
    <div>{content}</div>
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
