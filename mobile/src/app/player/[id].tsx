/**
 * Player screen — Route: /player/[id]
 *
 * Another player's profile (components/profile/Profile.tsx), opened from
 * the leaderboard or the home top 3. Only players who share a crew with you.
 *
 * Data: GET /api/v1/players/{id}
 */
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { PlayerProfile } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { CenterState, ErrorState, Txt } from "@/components/ui";
import { Profile } from "@/components/profile/Profile";
import { colors } from "@/theme";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { version } = useCrew();
  const q = useQuery<PlayerProfile>(`/players/${id}?lang=${locale}`, version);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.common.back} style={styles.round}>
          <Txt style={{ fontSize: 20 }}>‹</Txt>
        </Pressable>
      </View>
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <CenterState />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
        >
          <Profile data={q.data} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { height: 52, paddingHorizontal: 16, justifyContent: "center" },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40 },
});
