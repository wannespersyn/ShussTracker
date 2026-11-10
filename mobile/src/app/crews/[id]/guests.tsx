/**
 * Guests screen — Route: /crews/[id]/guests
 *
 * Guest players (people without an account yet) in a crew: add one by
 * name, send their claim link so their games move to a real account later,
 * and — owner only — remove one. Any member can add guests.
 *
 * Data: GET /api/v1/crews/{id}, POST …/guests, DELETE …/members/{guestId}
 */
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { api, apiUrl, ApiError } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Button, Card, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

export default function GuestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { version, invalidate } = useCrew();
  const q = useQuery<CrewDetail>(`/crews/${id}`, version);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const { crew, guests, insights } = q.data;
  const gamesOf = (gid: string) => insights.players.find((p) => p.userId === gid)?.games ?? 0;

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api(`/crews/${id}/guests`, { method: "POST", body: { name: name.trim() } });
      setName("");
      invalidate();
    } catch (e) {
      Alert.alert(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sendClaim(guest: { name: string; claimToken: string }) {
    const url = apiUrl(`/claim?code=${guest.claimToken}`);
    void Share.share({ message: format(t.crew.claimMessage, { name: guest.name, crew: crew.name, url, code: guest.claimToken }) });
  }

  function remove(guest: { id: string; name: string }) {
    Alert.alert(format(t.more.removeGuest, { name: guest.name }), undefined, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.more.remove,
        style: "destructive",
        onPress: async () => {
          await api(`/crews/${id}/members/${guest.id}`, { method: "DELETE" }).catch(() => null);
          invalidate();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header title={t.manage.guests} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 10 }}>
            <Kicker>{t.crew.addGuest}</Kicker>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t.more.guestName}
                placeholderTextColor={colors.dim}
                maxLength={40}
                style={styles.input}
                onSubmitEditing={add}
              />
              <View style={{ width: 110 }}>
                <Button label={t.crew.addGuest} disabled={!name.trim()} loading={busy} onPress={add} />
              </View>
            </View>
          </Card>

          {guests.length === 0 && <Txt style={{ color: colors.muted }}>—</Txt>}
          {guests.map((g) => (
            <View key={g.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Txt v="bodySemi">{g.name}</Txt>
                <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(t.manage.guestSub, { n: gamesOf(g.id) })}</Txt>
                {g.claimToken && (
                  <Txt style={{ fontSize: 12, color: colors.muted }}>
                    {`${t.more.claimCode} `}
                    <Txt style={{ fontFamily: fonts.headBold, color: colors.gold, letterSpacing: 1.5 }}>{g.claimToken}</Txt>
                  </Txt>
                )}
              </View>
              {g.claimToken && (
                <Pressable onPress={() => sendClaim({ name: g.name, claimToken: g.claimToken! })} style={styles.pill}>
                  <Txt style={styles.pillText}>{t.crew.sendClaim}</Txt>
                </Pressable>
              )}
              {crew.isOwner && (
                <Pressable onPress={() => remove(g)} hitSlop={8}>
                  <Txt style={{ color: colors.red, fontFamily: fonts.headBold }}>✕</Txt>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  input: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pill: { height: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: colors.gold },
  pillText: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 0.8, color: colors.ink, textTransform: "uppercase" },
});
