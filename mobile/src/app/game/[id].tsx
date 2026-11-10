/**
 * Game screen — Route: /game/[id]
 *
 * One game's result: teams in finishing order with each player's mama hits
 * and Elo change, the shot-zone totals when tracked, the mat photo,
 * reactions and trash talk (comments). Anyone in the crew can add or change
 * the photo; the logger, crew owner or an admin can delete the game.
 *
 * Data: GET/DELETE /api/v1/games/{id}, POST …/reactions, POST/DELETE …/comments,
 *       POST …/photo
 */
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { api, apiUrl, authHeaders } from "@/api/client";
import type { GameComment, GameDetail, Reaction, ReactionTally } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { PhotoButton } from "@/components/game/PhotoButton";
import { colors, fonts, radius } from "@/theme";

const GLYPH: Record<Reaction, string> = { fire: "🔥", laugh: "😂", beer: "🍺", skull: "💀" };
const first = (name: string | null) => (name ?? "?").trim().split(/\s+/)[0] ?? "?";

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { me } = useAuth();
  const { invalidate, setCrewId } = useCrew();
  const q = useQuery<GameDetail>(`/games/${id}`);
  const [reactions, setReactions] = useState<ReactionTally[] | null>(null);
  const [comments, setComments] = useState<GameComment[] | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const { game } = q.data;
  const shownReactions = reactions ?? q.data.reactions;
  const shownComments = comments ?? q.data.comments;
  const shownPhoto = photoPath === undefined ? game.photoPath : photoPath;
  const multi = game.teams.length > 2;
  const ORD = [t.more.ord1, t.more.ord2, t.more.ord3, t.more.ord4];
  const when = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(game.playedAt));
  const matLabel = game.matType === "2" ? "1V1" : game.matType === "4" ? "2V2" : "8-MAT";
  const zoneTotals = (["1", "2", "3", "mama", "miss"] as const).map(
    (z) => [z, game.teams.reduce((n, tm) => n + tm.players.reduce((m, p) => m + p.shots[z], 0), 0)] as const,
  );
  const tracked = zoneTotals.some(([z, n]) => z !== "mama" && n > 0);

  async function react(reaction: Reaction) {
    const res = await api<{ reactions: ReactionTally[] }>(`/games/${id}/reactions`, { method: "POST", body: { reaction } }).catch(() => null);
    if (res) setReactions(res.reactions);
  }

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await api<{ comments: GameComment[] }>(`/games/${id}/comments`, { method: "POST", body: { text: text.trim() } }).catch(() => null);
    setSending(false);
    if (res) {
      setComments(res.comments);
      setText("");
    }
  }

  async function removeComment(commentId: string) {
    await api(`/games/${id}/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    setComments(shownComments.filter((c) => c.id !== commentId));
  }

  function confirmDelete() {
    Alert.alert(t.game.deleteGame, t.game.deleteConfirm, [
      { text: t.game.cancel, style: "cancel" },
      {
        text: t.game.deleteGame,
        style: "destructive",
        onPress: async () => {
          await api(`/games/${id}`, { method: "DELETE" });
          invalidate();
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.common.back} style={styles.round}>
            <Txt style={{ fontSize: 20 }}>‹</Txt>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Kicker>{`${matLabel}${game.crew ? ` · ${game.crew.name}` : ""}`}</Kicker>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>{when}</Txt>
          </View>
          <View style={styles.round} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
          keyboardShouldPersistTaps="handled"
        >
          {shownPhoto && (
            <Image source={{ uri: apiUrl(shownPhoto), headers: authHeaders() }} style={styles.photo} contentFit="cover" accessibilityLabel={t.game.photoAlt} />
          )}

          <Kicker>{t.game.result}</Kicker>
          {game.teams.map((tm, i) => {
            const won = (tm.finalRank ?? i + 1) === 1;
            const mama = tm.players.reduce((n, p) => n + p.shots.mama, 0);
            return (
              <View key={i} style={[styles.team, won && { borderColor: colors.gold }]}>
                <View style={[styles.rank, won ? { backgroundColor: colors.gold } : { backgroundColor: colors.chip }]}>
                  <Text style={[styles.rankText, { color: won ? colors.ink : colors.soft }]}>{multi ? ORD[(tm.finalRank ?? i + 1) - 1] : won ? "W" : "L"}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={styles.teamName} numberOfLines={1}>
                    {tm.players.map((p) => first(p.name)).join(" & ")}
                  </Txt>
                  {mama > 0 && <Txt style={{ color: colors.red, fontFamily: fonts.headBold }}>{format(t.feed.mamaN, { n: mama }).toUpperCase()}</Txt>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {tm.players.map((p) =>
                    p.eloDelta === null ? null : (
                      <Txt key={p.id} style={{ fontFamily: fonts.headBold, color: p.eloDelta >= 0 ? colors.mint : colors.redPale }}>
                        {`${first(p.name)} ${p.eloDelta >= 0 ? "+" : "−"}${Math.abs(p.eloDelta)}`}
                      </Txt>
                    ),
                  )}
                </View>
              </View>
            );
          })}

          {tracked && (
            <View style={styles.zones}>
              {zoneTotals.map(([z, n]) => (
                <View key={z} style={styles.zone}>
                  <Txt style={[styles.zoneN, z === "mama" && { color: colors.red }]}>{n}</Txt>
                  <Txt v="label" style={{ fontSize: 10 }}>
                    {z === "mama" ? t.common.mama : z === "miss" ? t.more.miss : format(t.more.field, { n: z })}
                  </Txt>
                </View>
              ))}
            </View>
          )}

          <PhotoButton gameId={game.id} hasPhoto={!!shownPhoto} onUploaded={setPhotoPath} />

          <Kicker>{t.game.reactions}</Kicker>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {shownReactions.map((r) => (
              <Pressable
                key={r.reaction}
                onPress={() => react(r.reaction)}
                style={[styles.reaction, r.reactedByMe && { borderColor: colors.gold, backgroundColor: colors.raised }]}
              >
                <Text style={{ fontSize: 20 }}>{GLYPH[r.reaction]}</Text>
                {r.count > 0 && <Txt style={{ fontFamily: fonts.headBold }}>{r.count}</Txt>}
              </Pressable>
            ))}
          </View>

          <Kicker>{shownComments.length ? format(t.game.trashTalkN, { n: shownComments.length }) : t.game.trashTalk}</Kicker>
          {shownComments.length === 0 && <Txt style={{ color: colors.muted }}>{t.game.noComments}</Txt>}
          {shownComments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Avatar name={c.userName} size={30} />
              <View style={{ flex: 1 }}>
                <Txt v="bodySemi" style={{ fontSize: 13 }}>
                  {first(c.userName)}
                </Txt>
                <Txt>{c.text}</Txt>
              </View>
              {c.userId === me?.user.id && (
                <Pressable onPress={() => removeComment(c.id)} hitSlop={8} accessibilityLabel={t.game.delete}>
                  <Txt style={{ color: colors.muted }}>✕</Txt>
                </Pressable>
              )}
            </View>
          ))}

          {!game.tournamentId && game.crew && (
            <Button
              label={t.game.rematch}
              kind="outline"
              onPress={() => {
                if (game.crew) setCrewId(game.crew.id);
                router.navigate({ pathname: "/log", params: { teams: game.teams.flatMap((tm) => tm.players.map((p) => p.id)).join(",") } });
              }}
            />
          )}

          {game.canDelete && (
            <Pressable onPress={confirmDelete} style={{ alignSelf: "center", padding: 12, marginTop: 8 }}>
              <Txt style={{ color: colors.redPale, fontFamily: fonts.bodySemi }}>{t.game.deleteGame}</Txt>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.game.placeholder}
            placeholderTextColor={colors.dim}
            style={styles.input}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
            <Text style={styles.sendText}>{t.game.send}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 52 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  content: { padding: 20, gap: 12, paddingBottom: 24 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.deep },
  team: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.deep,
    borderWidth: 2,
    borderColor: colors.line,
  },
  rank: { minWidth: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  rankText: { fontFamily: fonts.display, fontSize: 18 },
  teamName: { fontFamily: fonts.headBold, fontSize: 19, color: colors.cream, textTransform: "uppercase" },
  zones: { flexDirection: "row", gap: 6 },
  zone: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  zoneN: { fontFamily: fonts.display, fontSize: 20 },
  reaction: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  comment: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  composer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  send: { height: 44, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.gold, justifyContent: "center" },
  sendText: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 0.8, color: colors.ink, textTransform: "uppercase" },
});
