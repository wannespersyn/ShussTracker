/**
 * Americano / Mexicano — Route: /americano/[id]
 *
 * One rotation tournament, like the website: header (manage + TV for the
 * organizer), round progress, and three tabs — Live (games on the mats with
 * "log result", who sits out, what's next, top 3), Standings (podium +
 * table) and Rounds (every result). Once finished: champion, awards, final
 * table, share and "again with these players". Refreshes every 15 s.
 *
 * Data: GET /api/v1/rotations/{id}, POST …/finish
 */
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useRotation } from "@/lib/useRotation";
import { CenterState, ErrorState } from "@/components/ui";
import { FinalView, LiveTab, Podium, RotationHeader, RotationTabs, RoundProgress, RoundsTab, StandingsTable, type RotationTab } from "@/components/rotation/RotationScreens";
import { colors, fonts } from "@/theme";

export default function RotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const R = t.rot;
  const { me } = useAuth();
  const { invalidate } = useCrew();
  const q = useRotation(id);
  const [tab, setTab] = useState<RotationTab>("live");

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const { rotation: v, canManage } = q.data;
  const userId = me?.user.id ?? "";
  const live = v.status !== "completed";
  const champ = v.standings.find((x) => x.games > 0);

  function finish() {
    Alert.alert(R.finish, R.finishConfirm, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: R.finish,
        style: "destructive",
        onPress: async () => {
          await api(`/rotations/${v.id}/finish`, { method: "POST" }).catch(() => null);
          invalidate();
          void q.reload();
        },
      },
    ]);
  }

  const finishSlot =
    live && canManage ? (
      <Pressable onPress={finish} style={styles.finish}>
        <Text style={styles.finishText}>{R.finish}</Text>
      </Pressable>
    ) : undefined;

  const endActions = (
    <View style={{ gap: 10 }}>
      <Pressable onPress={() => void Share.share({ message: format(R.shareTitle, { name: v.name, champ: champ ? q.name(champ.userId) : "" }) })} style={styles.primary}>
        <Text style={styles.primaryText}>{R.share}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: "/americano/new", params: { crewId: v.groupId, players: v.players.map((p) => p.id).join(",") } })}
        style={styles.secondary}
      >
        <Text style={[styles.primaryText, { color: colors.cream, fontSize: 17 }]}>{R.again}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}>
        <RotationHeader
          v={v}
          R={R}
          onBack={() => router.back()}
          onTv={live ? () => router.push({ pathname: "/americano/[id]/tv", params: { id: v.id } }) : undefined}
          onManage={live && canManage ? () => router.push({ pathname: "/americano/[id]/manage", params: { id: v.id } }) : undefined}
        />
        {live && <RoundProgress v={v} R={R} />}
        <RotationTabs tab={tab} onChange={setTab} R={R} />
        {tab === "live" &&
          (live ? (
            <LiveTab v={v} R={R} name={q.name} userId={userId} onSeeAll={() => setTab("standings")} />
          ) : (
            <FinalView v={v} R={R} name={q.name} userId={userId} actions={endActions} />
          ))}
        {tab === "standings" && (
          <>
            <Podium top={v.standings.slice(0, 3)} name={q.name} />
            <StandingsTable v={v} R={R} name={q.name} userId={userId} />
            <Text style={styles.small}>{R.rankHow}</Text>
          </>
        )}
        {tab === "rounds" && <RoundsTab v={v} R={R} name={q.name} finishSlot={finishSlot} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted },
  finish: { alignSelf: "center", height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,138,124,0.45)", justifyContent: "center" },
  finishText: { fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 1.1, color: colors.redPale },
  primary: { height: 56, borderRadius: 16, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.headBold, fontSize: 19, letterSpacing: 1.1, color: colors.ink },
  secondary: { height: 50, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
});
