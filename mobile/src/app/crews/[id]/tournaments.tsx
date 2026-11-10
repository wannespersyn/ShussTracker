/**
 * Crew tournaments — Route: /crews/[id]/tournaments
 *
 * Every tournament of a crew, like the website: running ones first, then
 * finished ones with their winner — brackets and Americano / Mexicano —
 * plus the buttons to start a new one.
 *
 * Data: GET /api/v1/crews/{id}/events
 */
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import type { CrewEvent } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { CrewEventRow, NewEventButtons } from "@/components/events/CrewEvents";
import { colors } from "@/theme";

export default function CrewTournaments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { version } = useCrew();
  const q = useQuery<{ events: CrewEvent[] }>(`/crews/${id}/events`, version);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const running = q.data.events.filter((e) => e.live);
  const done = q.data.events.filter((e) => !e.live);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title={t.ev.pageTitle} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}>
        <NewEventButtons crewId={id} />
        {q.data.events.length === 0 && <Txt style={{ color: colors.muted }}>{t.ev.none}</Txt>}
        {running.length > 0 && (
          <View style={{ gap: 8 }}>
            <Kicker>{t.ev.running}</Kicker>
            {running.map((e) => (
              <CrewEventRow key={`${e.kind}-${e.id}`} e={e} />
            ))}
          </View>
        )}
        {done.length > 0 && (
          <View style={{ gap: 8 }}>
            <Kicker>{t.ev.finished}</Kicker>
            {done.map((e) => (
              <CrewEventRow key={`${e.kind}-${e.id}`} e={e} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 18, paddingBottom: 40 } });
