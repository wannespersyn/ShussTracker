/**
 * Me tab — Route: /me
 *
 * Your own profile (rank, Elo history, stats, head-to-heads, achievements,
 * nemesis), then links to deep stats, your recap and feedback, joining or
 * starting another crew, and settings: display name, language (EN / NL,
 * also used for errors and push notifications), privacy / terms, sign out
 * and account deletion (required by the App Store).
 *
 * Data: GET /api/v1/players/{myId}, PATCH /api/v1/me, DELETE /api/v1/me
 */
import { useState } from "react";
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, apiUrl } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import type { PlayerProfile } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { LOCALES, useT, type Locale } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, Card, Kicker, Segmented, Txt } from "@/components/ui";
import { LinkRow } from "@/components/Header";
import { Profile } from "@/components/profile/Profile";
import { colors, fonts, radius } from "@/theme";

const LABEL: Record<Locale, string> = { en: "English", nl: "Nederlands" };

export default function MeTab() {
  const { t, locale, setLocale } = useT();
  const { me, signOut, refreshMe } = useAuth();
  const { crew, version, invalidate } = useCrew();
  // ?lang refetches the translated achievement names after a language switch.
  const q = useQuery<PlayerProfile>(me ? `/players/${me.user.id}?lang=${locale}` : null, version);
  const [name, setName] = useState<string | null>(null);
  const shownName = name ?? me?.user.name ?? "";

  async function saveName() {
    await api("/me", { method: "PATCH", body: { name: shownName.trim() } }).catch(() => null);
    setName(null);
    await refreshMe().catch(() => {});
    invalidate();
  }

  function deleteAccount() {
    Alert.alert(t.settings.deleteAccount, t.settings.deleteAccountBody, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.settings.deleteAccountCta,
        style: "destructive",
        onPress: async () => {
          await api("/me", { method: "DELETE", body: { confirm: "DELETE" } });
          await signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        {q.data ? (
          <Profile data={q.data} viewerId={me?.user.id} />
        ) : (
          <View style={styles.head}>
            <Avatar name={me?.user.name ?? t.more.player} size={64} />
            <Txt v="display" numberOfLines={1} style={{ flex: 1 }}>
              {me?.user.name ?? t.more.player}
            </Txt>
          </View>
        )}

        <View style={{ gap: 8, marginTop: 6 }}>
          <LinkRow label={t.profile.deepStats} onPress={() => router.push("/stats")} />
          {crew && (
            <LinkRow
              label={t.profile.recap}
              sub={t.profile.recapSub}
              onPress={() => router.push({ pathname: "/recap/[crewId]", params: { crewId: crew.id } })}
            />
          )}
          <LinkRow label={t.settings.help} onPress={() => router.push("/feedback")} />
          <LinkRow label={t.app.anotherCrew} onPress={() => router.push("/crews/new")} />
        </View>

        <Kicker style={{ marginTop: 8 }}>{t.settings.title}</Kicker>
        <Card style={{ gap: 10 }}>
          <Kicker>{t.settings.name}</Kicker>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={shownName} onChangeText={setName} maxLength={60} style={styles.input} placeholderTextColor={colors.dim} />
            <View style={{ width: 100 }}>
              <Button label={t.settings.save} disabled={!shownName.trim() || shownName.trim() === me?.user.name} onPress={saveName} />
            </View>
          </View>
        </Card>
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
        <View style={{ gap: 8 }}>
          <LinkRow label={t.more.privacy} onPress={() => void Linking.openURL(apiUrl("/privacy"))} />
          <LinkRow label={t.more.terms} onPress={() => void Linking.openURL(apiUrl("/terms"))} />
        </View>
        <Button label={t.app.signOut} kind="outline" onPress={signOut} />
        <View style={{ marginTop: 10 }}>
          <LinkRow label={t.settings.deleteAccount} danger onPress={deleteAccount} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  input: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.cream,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
});
