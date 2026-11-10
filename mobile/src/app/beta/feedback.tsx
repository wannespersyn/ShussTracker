/**
 * Beta feedback — Route: /beta/feedback?feature=
 *
 * The website's feedback sheet: a 4-step rating, tags (multiple), free
 * text, send; then a thank-you. For one feature or the beta as a whole.
 *
 * Data: POST /api/v1/beta/feedback
 */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { BetaKey } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { BETA_FEATURES, BETA_TAGS, useBetaActions } from "@/lib/beta";
import { Button, Kicker } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

export default function BetaFeedback() {
  const params = useLocalSearchParams<{ feature?: string }>();
  const { t } = useT();
  const B = t.beta;
  const actions = useBetaActions();
  const key = BETA_FEATURES.find((f) => f.key === params.feature)?.key as BetaKey | undefined;
  const name = key ? B.features[key].title : B.general;
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const ready = rating !== null || tags.length > 0 || text.trim().length > 0;

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    const ok = await actions.feedback({ feature: key ?? "beta", rating, tags, text: text.trim() }).then(
      () => true,
      () => false,
    );
    setSending(false);
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <Header close />
        <View style={styles.thanks}>
          <Text style={{ fontSize: 56 }}>🙌</Text>
          <Text style={styles.title}>{B.fbThanksTitle}</Text>
          <Text style={[styles.body, { textAlign: "center" }]}>{B.fbThanksBody}</Text>
          <View style={{ width: "100%", marginTop: 16 }}>
            <Button label={B.backToBeta} onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header close />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Kicker>{format(B.fbKicker, { feature: name })}</Kicker>
          <Text style={styles.title}>{format(B.fbTitle, { feature: name })}</Text>
          <Kicker>{B.fbRating}</Kicker>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[B.rate1, B.rate2, B.rate3, B.rate4].map((label, i) => {
              const on = rating === i + 1;
              return (
                <Pressable key={label} onPress={() => setRating(on ? null : i + 1)} style={[styles.rate, on && styles.on]}>
                  <Text style={{ fontSize: 22 }}>{["😕", "🙂", "😃", "🤩"][i]}</Text>
                  <Text style={[styles.rateText, on && { color: colors.ink }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Kicker>{B.fbTags}</Kicker>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BETA_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable key={tag} onPress={() => setTags(on ? tags.filter((x) => x !== tag) : [...tags, tag])} style={[styles.tag, on && styles.on]}>
                  <Text style={[styles.rateText, on && { color: colors.ink }]}>{B.tags[tag]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Kicker>{B.fbText}</Kicker>
          <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder={B.fbPlaceholder} placeholderTextColor={colors.dim} style={styles.input} />
          <Button label={B.fbSend} disabled={!ready} loading={sending} onPress={send} />
          <Text style={[styles.small, { textAlign: "center" }]}>{B.fbNote}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: colors.cream, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.soft },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  rate: { flex: 1, height: 74, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 4 },
  rateText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.cream },
  on: { backgroundColor: colors.gold, borderColor: colors.gold },
  tag: { height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" },
  input: { minHeight: 110, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, padding: 14, color: colors.cream, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  thanks: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
});
