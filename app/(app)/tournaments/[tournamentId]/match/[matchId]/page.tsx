import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tournamentMatches, groups } from "@/lib/db/schema";
import { requireSession, requireGroupMember } from "@/lib/db/authz";
import { MatchPlayer } from "@/components/tournaments/MatchPlayer";

export default async function TournamentMatchPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>;
}) {
  const { tournamentId, matchId } = await params;
  const session = await requireSession();

  const match = await db.query.tournamentMatches.findFirst({
    where: eq(tournamentMatches.id, matchId),
    with: {
      tournament: true,
      entrantA: { with: { player1: true, player2: true } },
      entrantB: { with: { player1: true, player2: true } },
    },
  });
  if (!match || match.tournamentId !== tournamentId) notFound();

  try {
    await requireGroupMember(session.user.id, match.tournament.groupId);
  } catch {
    notFound();
  }

  // Not playable yet (waiting on a previous round) or already played.
  if (!match.entrantA || !match.entrantB || match.gameId) notFound();

  const group = await db.query.groups.findFirst({ where: eq(groups.id, match.tournament.groupId) });

  const entrantA = match.entrantA;
  const entrantB = match.entrantB;

  const teamA = {
    entrantId: entrantA.id,
    label: `${entrantA.player1.name?.split(" ")[0] ?? "Player"} & ${entrantA.player2.name?.split(" ")[0] ?? "Player"}`,
    players: [
      { id: entrantA.player1Id, name: entrantA.player1.name ?? "Player" },
      { id: entrantA.player2Id, name: entrantA.player2.name ?? "Player" },
    ] as [{ id: string; name: string }, { id: string; name: string }],
  };
  const teamB = {
    entrantId: entrantB.id,
    label: `${entrantB.player1.name?.split(" ")[0] ?? "Player"} & ${entrantB.player2.name?.split(" ")[0] ?? "Player"}`,
    players: [
      { id: entrantB.player1Id, name: entrantB.player1.name ?? "Player" },
      { id: entrantB.player2Id, name: entrantB.player2.name ?? "Player" },
    ] as [{ id: string; name: string }, { id: string; name: string }],
  };

  return (
    <MatchPlayer
      matchId={match.id}
      tournamentId={tournamentId}
      teamA={teamA}
      teamB={teamB}
      trackShotZones={group?.trackShotZones ?? false}
    />
  );
}
