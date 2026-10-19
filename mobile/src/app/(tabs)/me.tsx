/**
 * Me tab — Route: /me
 *
 * Your own profile (rank, Elo history, stats, achievements, nemesis) with
 * a way to join or start another crew, then the app settings: language (EN / NL, also used for errors and
 * push notifications) and sign out.
 *
 * Data: GET /api/v1/players/{myId}
 */
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import type { PlayerProfile } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { LOCALES, useT, type Locale } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, Card, Kicker, Segmented, Txt } from "@/components/ui";
import { Profile } from "@/components/profile/Profile";
import { colors } from "@/theme";

const LABEL: Record<Locale, string> = { en: "English", nl: "Nederlands" };

export default function MeTab() {
  const { t, locale, setLocale } = useT();
  const { me, signOut } = useAuth();
  const { version } = useCrew();
  const q = useQuery<PlayerProfile>(me ? `/players/${me.user.id}?lang=${locale}` : null, version); // ?lang refetches translated achievements
  const name = me?.user.name ?? t.more.player;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        {q.data ? (
          <Profile data={q.data} />
        ) : (
          <View style={styles.head}>
            <Avatar name={name} size={64} />
            <Txt v="display" numberOfLines={1} style={{ flex: 1 }}>
              {name}
            </Txt>
          </View>
        )}

        <Button label={t.app.anotherCrew} kind="outline" onPress={() => router.push("/crews/new")} />

        <Kicker style={{ marginTop: 8 }}>{t.settings.title}</Kicker>
        <Card style={{ gap: 10 }}>
          <Kicker>{t.app.language}</Kicker>
          <Segmented value={locale} onChange={setLocale} options={LOCALES.map((l) => ({ id: l, label: LABEL[l] }))} />
        </Card>
        {me?.user.email && (
          <Card style={{ gap: 2 }}>
            <Kicker>{t.settings.signedIn}</Kicker>
            <Txt numberOfLines={1}>{me.user.email}</Txt>
          </Card>
        )}
        <Button label={t.app.signOut} kind="outline" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
});
