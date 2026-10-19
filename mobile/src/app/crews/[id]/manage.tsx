/**
 * Manage crew — Route: /crews/[id]/manage (owner only)
 *
 * The website's "Manage crew" in the app: invite code (share or replace),
 * the crew's "track every shot" default, rename, members (remove) and
 * delete the crew.
 *
 * Data: GET/PATCH/DELETE /api/v1/crews/{id}, POST …/invite-code,
 *       DELETE …/members/{userId}
 */
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api, apiUrl } from "@/api/client";
import type { CrewDetail } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, Card, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header, LinkRow } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

export default function ManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { me, refreshMe } = useAuth();
  const { version, invalidate } = useCrew();
  const q = useQuery<CrewDetail>(`/crews/${id}`, version);
  const [name, setName] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [track, setTrack] = useState<boolean | null>(null);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const { crew, insights } = q.data;
  if (!crew.isOwner) return <CenterState title="—" />;

  const inviteCode = code ?? crew.inviteCode ?? "";
  const shownName = name ?? crew.name;
  const tracking = track ?? crew.trackShotZones;
  const members = insights.players.filter((p) => !p.isGuest);

  async function patch(body: Record<string, unknown>) {
    await api(`/crews/${id}`, { method: "PATCH", body }).catch(() => null);
    invalidate();
    await refreshMe().catch(() => {});
  }

  function share() {
    const url = apiUrl(`/crews/join?code=${inviteCode}`);
    void Share.share({ message: `${format(t.manage.shareTitle, { crew: crew.name })} — ${t.join.code}: ${inviteCode}\n${url}` });
  }

  async function newCode() {
    const res = await api<{ inviteCode: string }>(`/crews/${id}/invite-code`, { method: "POST" }).catch(() => null);
    if (res) setCode(res.inviteCode);
  }

  function removeMember(m: { userId: string; name: string }) {
    Alert.alert(format(t.manage.removeConfirm, { name: m.name, crew: crew.name }), undefined, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.more.remove,
        style: "destructive",
        onPress: async () => {
          await api(`/crews/${id}/members/${m.userId}`, { method: "DELETE" }).catch(() => null);
          invalidate();
        },
      },
    ]);
  }

  function deleteCrew() {
    Alert.alert(t.manage.delete, format(t.manage.deleteConfirm, { crew: crew.name }), [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.manage.delete,
        style: "destructive",
        onPress: async () => {
          await api(`/crews/${id}`, { method: "DELETE" });
          await refreshMe();
          invalidate();
          router.dismissAll();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header title={t.manage.title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card raised style={{ gap: 10 }}>
            <Kicker>{t.manage.invite}</Kicker>
            <Txt style={styles.code}>{inviteCode}</Txt>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={t.manage.newCode} kind="outline" onPress={newCode} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button label={t.manage.share} onPress={share} />
              </View>
            </View>
          </Card>

          <Card style={styles.toggle}>
            <View style={{ flex: 1 }}>
              <Txt v="bodySemi">{t.manage.track}</Txt>
              <Txt style={{ color: colors.muted, fontSize: 12 }}>{t.manage.trackSub}</Txt>
            </View>
            <Switch
              value={tracking}
              onValueChange={(v) => {
                setTrack(v);
                void patch({ trackShotZones: v });
              }}
              trackColor={{ true: colors.gold, false: colors.chip }}
              thumbColor={tracking ? colors.ink : colors.muted}
            />
          </Card>

          <Card style={{ gap: 10 }}>
            <Kicker>{t.manage.name}</Kicker>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={shownName} onChangeText={setName} maxLength={40} style={styles.input} placeholderTextColor={colors.dim} />
              <View style={{ width: 100 }}>
                <Button
                  label={t.settings.save}
                  disabled={!shownName.trim() || shownName.trim() === crew.name}
                  onPress={() => patch({ name: shownName.trim() })}
                />
              </View>
            </View>
          </Card>

          <LinkRow label={t.manage.guests} sub={`${q.data.guests.length}`} onPress={() => router.push({ pathname: "/crews/[id]/guests", params: { id } })} />

          <Kicker>{format(t.manage.membersN, { n: members.length })}</Kicker>
          {members.map((m) => (
            <View key={m.userId} style={styles.member}>
              <Avatar name={m.name} size={34} />
              <View style={{ flex: 1 }}>
                <Txt v="bodySemi" numberOfLines={1}>
                  {m.name}
                </Txt>
                <Txt style={{ color: colors.muted, fontSize: 12 }}>
                  {m.userId === me?.user.id ? format(t.manage.youGames, { n: m.games }) : format(t.manage.games, { n: m.games })}
                </Txt>
              </View>
              {m.userId === crew.createdBy ? (
                <Txt style={styles.tag}>ADMIN</Txt>
              ) : (
                <Pressable onPress={() => removeMember(m)} hitSlop={8} accessibilityLabel={format(t.manage.remove, { name: m.name })}>
                  <Txt style={{ color: colors.red, fontFamily: fonts.headBold }}>✕</Txt>
                </Pressable>
              )}
            </View>
          ))}

          <View style={{ marginTop: 16 }}>
            <LinkRow label={t.manage.delete} danger onPress={deleteCrew} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  code: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 6, color: colors.cream },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tag: { fontFamily: fonts.headBold, fontSize: 11, letterSpacing: 1, color: colors.gold },
});
