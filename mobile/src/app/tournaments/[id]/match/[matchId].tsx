/**
 * Play a tournament match — Route: /tournaments/[id]/match/[matchId]
 *
 * The log flow's result step with the bracket's two duos locked in: tap
 * the winner, count mama hits (or every shot) and save. The winner moves on
 * in the bracket and the game counts for Elo like any other.
 *
 * Data: GET /api/v1/tournaments/{id} + /crews/{crewId},
 *       POST /api/v1/tournaments/{id}/matches/{matchId}
 */
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/api/client";
import type { CrewDetail, Tournament } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { useQuery } from "@/lib/useQuery";
import { CenterState, ErrorState } from "@/components/ui";
import { Header } from "@/components/Header";
import { LogGame } from "@/components/log/LogGame";
import type { Team } from "@/lib/teams";
import { colors } from "@/theme";

export default function PlayMatch() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const { version, invalidate } = useCrew();
  const tq = useQuery<{ tournament: Tournament }>(`/tournaments/${id}`, version);
  const crewId = tq.data?.tournament.groupId ?? null;
  const cq = useQuery<CrewDetail>(crewId ? `/crews/${crewId}` : null, version);

  const err = tq.error ?? cq.error;
  if (err && !(tq.data && cq.data)) return <ErrorState error={err} onRetry={() => (tq.error ? tq.reload() : cq.reload())} />;
  if (!tq.data || !cq.data) return <CenterState />;

  const tr = tq.data.tournament;
  const matches = [...tr.winnersRounds.flat(), ...tr.losersRounds.flat(), ...(tr.grandFinal ? [tr.grandFinal] : []), ...tr.roundRobinRounds.flat()];
  const match = matches.find((m) => m.id === matchId);
  if (!match?.entrantA || !match.entrantB || match.gameId) return <CenterState title="—" />;

  const nameOf = (pid: string) => cq.data!.insights.players.find((p) => p.userId === pid)?.name ?? "?";
  const lockedTeams: Team[] = [match.entrantA, match.entrantB].map((e) => ({
    id: e.id,
    label: e.names,
    players: e.playerIds.map((pid) => ({ id: pid, name: nameOf(pid) })),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title={tr.name} />
      <LogGame
        detail={cq.data}
        lockedTeams={lockedTeams}
        submit={async (result) => {
          const winner = result.teams.find((x) => x.finalRank === 1)!;
          const res = await api<{ gameId: string }>(`/tournaments/${id}/matches/${matchId}`, {
            method: "POST",
            body: { winnerEntrantId: winner.id, shotsByPlayer: result.shotsByPlayer },
          });
          return res.gameId;
        }}
        onSaved={() => {
          invalidate();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
