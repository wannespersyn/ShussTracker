/**
 * Americano TV view — Route: /americano/[id]/tv
 *
 * The big-screen version of a running Americano / Mexicano (AirPlay or a
 * tablet next to the mats): games on the mats in huge type, who sits out,
 * what's next and the standings. Refreshes every 15 s; tap ✕ to go back.
 *
 * Data: GET /api/v1/rotations/{id}
 */
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { format, useT } from "@/lib/i18n";
import { matsNow, rotationProgress } from "@/lib/rotation-view";
import { useRotation } from "@/lib/useRotation";
import { CenterState, ErrorState } from "@/components/ui";
import { RoundProgress } from "@/components/rotation/RotationScreens";
import { colors, fonts } from "@/theme";

export default function RotationTv() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const R = t.rot;
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const q = useRotation(id);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const v = q.data.rotation;
  const duo = (ids: readonly string[]) => ids.map(q.name).join(" & ");
  const { now, queue } = matsNow(v);
  const p = rotationProgress(v);
  const rest = v.byes[p.current] ?? [];
  const live = v.status !== "completed";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel={t.common.back}>
            <Text style={{ color: colors.cream, fontSize: 18 }}>✕</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.title}>
              {v.name}
            </Text>
            <Text style={styles.small}>{format(R.meta, { mode: v.mode === "americano" ? R.americano : R.mexicano, n: v.players.length, m: v.mats })}</Text>
          </View>
          <View style={[styles.live, !live && { backgroundColor: colors.raised }]}>
            <Text style={[styles.liveText, !live && { color: colors.muted }]}>{live ? R.live : R.done}</Text>
          </View>
        </View>
        {live && <RoundProgress v={v} R={R} big />}
        <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
          <View style={{ flex: 2, gap: 16 }}>
            <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>
              {now.map((g, i) => (
                <View key={g.id} style={[styles.mat, wide && { flex: 1 }]}>
                  <Text style={styles.matHead}>{format(R.mat, { n: i + 1 })}</Text>
                  <View style={{ padding: 20, gap: 12 }}>
                    <Text style={styles.duo}>{duo(g.a)}</Text>
                    <Text style={[styles.small, { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 3 }]}>{R.vs}</Text>
                    <Text style={styles.duo}>{duo(g.b)}</Text>
                  </View>
                </View>
              ))}
            </View>
            {now.length === 0 && live && <Text style={[styles.small, { fontSize: 20 }]}>{format(R.waitingRound, { n: v.plannedRounds + 1 })}</Text>}
            {live && rest.length > 0 && (
              <View style={styles.box}>
                <Text style={styles.kicker}>{R.tvRest}</Text>
                <Text style={[styles.duo, { fontSize: 28 }]}>{rest.map(q.name).join(", ")}</Text>
              </View>
            )}
            {live && queue.length > 0 && (
              <View style={styles.box}>
                <Text style={styles.kicker}>{R.nextShort}</Text>
                {queue.slice(0, 2).map((g) => (
                  <Text key={g.id} style={[styles.small, { fontSize: 20, color: colors.soft, fontFamily: fonts.bodySemi }]}>
                    {`${duo(g.a)}  vs  ${duo(g.b)}`}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.kicker, { padding: 16, paddingBottom: 8 }]}>{R.tvStandings}</Text>
            {v.standings.map((s, i) => (
              <View key={s.userId} style={[styles.row, i === 0 && s.games > 0 && { backgroundColor: "rgba(255,182,39,0.12)" }]}>
                <Text style={[styles.rank, i === 0 && s.games > 0 && { color: colors.gold }]}>{i + 1}</Text>
                <Text numberOfLines={1} style={[styles.duo, { flex: 1, fontSize: 26 }]}>
                  {q.name(s.userId)}
                </Text>
                <Text style={styles.rank}>{`${s.wins}–${s.losses}`}</Text>
                <Text style={[styles.rank, { width: 56, textAlign: "right", color: s.elo > 0 ? colors.mint : s.elo < 0 ? colors.redPale : colors.muted }]}>
                  {`${s.elo > 0 ? "+" : ""}${s.elo}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 22 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, textTransform: "uppercase" },
  small: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  live: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.red },
  liveText: { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 2.4, color: colors.ink },
  mat: { borderRadius: 24, backgroundColor: colors.deep, borderWidth: 2, borderColor: "rgba(255,182,39,0.45)", overflow: "hidden" },
  matHead: { paddingHorizontal: 22, paddingVertical: 14, backgroundColor: "rgba(255,182,39,0.12)", fontFamily: fonts.headBold, fontSize: 22, letterSpacing: 3.4, color: colors.gold },
  duo: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.cream, textTransform: "uppercase" },
  box: { gap: 6, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  kicker: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 2.2, color: colors.muted, textTransform: "uppercase" },
  table: { borderRadius: 24, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "rgba(243,241,234,0.06)" },
  rank: { fontFamily: fonts.headBold, fontSize: 24, color: colors.muted },
});
