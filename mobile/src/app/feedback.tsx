/**
 * Feedback — Route: /feedback
 *
 * "Help build Shussapp": send a bug, idea or anything else, and vote on the
 * ideas board (most-voted first, with each idea's status).
 *
 * Data: GET/POST /api/v1/feedback, POST /api/v1/feedback/{id}/vote
 */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import type { Idea } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Button, Card, Kicker, Segmented, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

type Kind = "bug" | "idea" | "other";

export default function FeedbackScreen() {
  const { t } = useT();
  const F = t.feedback;
  const { crew } = useCrew();
  const q = useQuery<{ ideas: Idea[] }>("/feedback");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [kind, setKind] = useState<Kind>("idea");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = ideas ?? q.data?.ideas ?? [];

  const status: Record<Idea["status"], string> = {
    new: F.statusNew,
    under_review: F.statusReview,
    planned: F.statusPlanned,
    in_progress: F.statusProgress,
    done: F.statusProgress,
    declined: F.statusNew,
  };

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api("/feedback", { method: "POST", body: { type: kind, text: text.trim(), groupId: crew?.id } });
      setText("");
      setSent(true);
      if (kind === "idea") setIdeas((await api<{ ideas: Idea[] }>("/feedback")).ideas);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function vote(id: string) {
    const res = await api<{ ideas: Idea[] }>(`/feedback/${id}/vote`, { method: "POST" }).catch(() => null);
    if (res) setIdeas(res.ideas);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header title={F.title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSent(false);
            }}
            options={[
              { id: "bug", label: F.bug },
              { id: "idea", label: F.idea },
              { id: "other", label: F.other },
            ]}
          />
          <Kicker>{kind === "bug" ? F.bugPrompt : kind === "idea" ? F.ideaPrompt : F.otherPrompt}</Kicker>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setSent(false);
            }}
            placeholder={kind === "bug" ? F.bugPlaceholder : kind === "idea" ? F.ideaPlaceholder : F.otherPlaceholder}
            placeholderTextColor={colors.dim}
            multiline
            maxLength={1000}
            style={styles.input}
          />
          {sent && <Txt style={{ color: colors.mint }}>{F.thanks}</Txt>}
          {error && <Txt style={{ color: colors.redPale }}>{error}</Txt>}
          <Button label={F.send} disabled={text.trim().length < 3} loading={busy} onPress={send} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 }}>
            <Kicker>{F.mostWanted}</Kicker>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>{F.topBuilt}</Txt>
          </View>
          {list.length === 0 && <Txt style={{ color: colors.muted }}>{F.noIdeas}</Txt>}
          {list.map((idea) => (
            <Card key={idea.id} style={styles.idea}>
              <Pressable onPress={() => vote(idea.id)} style={[styles.vote, idea.votedByMe && styles.voteOn]} accessibilityLabel={F.upvote}>
                <Text style={[styles.voteArrow, idea.votedByMe && { color: colors.ink }]}>▲</Text>
                <Text style={[styles.voteCount, idea.votedByMe && { color: colors.ink }]}>{idea.votes}</Text>
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt>{idea.text}</Txt>
                <Txt style={styles.status}>{status[idea.status].toUpperCase()}</Txt>
              </View>
            </Card>
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
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
    textAlignVertical: "top",
  },
  idea: { flexDirection: "row", gap: 12, alignItems: "center" },
  vote: {
    width: 46,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  voteOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  voteArrow: { fontSize: 12, color: colors.muted },
  voteCount: { fontFamily: fonts.display, fontSize: 18, color: colors.cream },
  status: { fontFamily: fonts.headBold, fontSize: 11, letterSpacing: 1, color: colors.gold },
});
