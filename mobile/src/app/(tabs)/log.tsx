/**
 * Log tab — Route: /log
 *
 * Logs a game in the selected crew (components/log/LogGame.tsx), then
 * refreshes the crew screens and opens the new game. `?teams=` (from
 * Chwazi) preloads the teams.
 *
 * Data: GET /api/v1/crews/{crewId} for the roster, Elo and duo records.
 */
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCrew } from "@/lib/crew";
import { useQuery } from "@/lib/useQuery";
import type { CrewDetail } from "@/api/types";
import { CenterState, ErrorState } from "@/components/ui";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { NoCrew } from "@/components/crew/NoCrew";
import { LogGame } from "@/components/log/LogGame";
import { colors } from "@/theme";
import { View } from "react-native";

export default function LogTab() {
  const { crew, version, invalidate } = useCrew();
  const { teams } = useLocalSearchParams<{ teams?: string }>();
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);

  if (!crew) return <NoCrew />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <CrewSwitcher />
      </View>
      <LogGame
        key={`${q.data.crew.id}:${teams ?? ""}`}
        detail={q.data}
        presetPlayerIds={teams ? teams.split(",") : undefined}
        onSaved={(gameId) => {
          if (teams) router.setParams({ teams: undefined });
          invalidate();
          router.push({ pathname: "/game/[id]", params: { id: gameId } });
        }}
      />
    </SafeAreaView>
  );
}
