/**
 * Log an Americano game — Route: /americano/[id]/game/[slotId]
 *
 * The log flow with the two planned duos locked in (start, then the mat
 * logger or the result: winner, mamas, kruipen). Saving links the game to
 * its slot in the rotation; if someone else logged it first, nothing
 * double-counts and you go back.
 *
 * Data: GET /api/v1/rotations/{id} + /crews/{crewId},
 *       POST /api/v1/rotations/games/{slotId}
 */
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { useRotation } from "@/lib/useRotation";
import { CenterState, ErrorState } from "@/components/ui";
import { Header } from "@/components/Header";
import { LogGame } from "@/components/log/LogGame";
import type { Team } from "@/lib/teams";
import { colors } from "@/theme";

export default function PlayRotationGame() {
  const { id, slotId } = useLocalSearchParams<{ id: string; slotId: string }>();
  const { t } = useT();
  const { invalidate } = useCrew();
  const rq = useRotation(id, false);
  const crewId = rq.data?.rotation.groupId ?? null;
  const cq = useQuery<CrewDetail>(crewId ? `/crews/${crewId}` : null);

  const err = rq.error ?? cq.error;
  if (err && !(rq.data && cq.data)) return <ErrorState error={err} onRetry={() => (rq.error ? rq.reload() : cq.reload())} />;
  if (!rq.data || !cq.data) return <CenterState />;
  const v = rq.data.rotation;
  const slot = v.games.find((g) => g.id === slotId);
  if (!slot) return <CenterState title="—" body={t.rot.notFound} />;
  if (slot.played) return <CenterState title="—" body={t.rot.alreadyPlayed} />;

  const fullName = (pid: string) => v.players.find((p) => p.id === pid)?.name ?? "?";
  const lockedTeams: Team[] = [slot.a, slot.b].map((ids, i) => ({
    id: `team-${i}`,
    label: ids.map(rq.name).join(" & "),
    players: ids.map((pid) => ({ id: pid, name: fullName(pid) })),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title={`${v.name} · ${t.rot.round.replace("{n}", String(slot.round))}`} />
      <LogGame
        detail={cq.data}
        lockedTeams={lockedTeams}
        submit={async (result) => {
          const res = await api<{ rotationId: string; gameId: string | null }>(`/rotations/games/${slotId}`, {
            method: "POST",
            body: { teams: result.teams.map(({ id: _id, ...x }) => x), shotsByPlayer: result.shotsByPlayer, mat: result.mat },
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
