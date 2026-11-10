/**
 * Shussapp Beta — Route: /beta
 *
 * Settings › Beta, like the website: not in the beta yet → the welcome
 * card with "Yes, I'm in"; in the beta → every beta feature with its own
 * switch, where to find it and a link to its explainer + feedback, plus
 * "feedback on the beta" and "leave the beta".
 *
 * Data: /me (beta state), PATCH /api/v1/me/beta
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import { format, useT } from "@/lib/i18n";
import { BETA_FEATURES, BETA_ICON, useBetaActions } from "@/lib/beta";
import { Kicker, Toggle } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

export default function BetaScreen() {
  const { t } = useT();
  const B = t.beta;
  const { me } = useAuth();
  const actions = useBetaActions();
  const [busy, setBusy] = useState<string | null>(null);
  const beta = me?.beta;
  if (!beta) return null;

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    await fn().catch(() => null);
    setBusy(null);
  }

  if (!beta.optIn) {
    const steps = [
      [B.welcome1Title, B.welcome1Body],
      [B.welcome2Title, B.welcome2Body],
      [B.welcome3Title, B.welcome3Body],
    ];
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <Header />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.welcome}>
            <View style={styles.flask}>
              <Text style={{ fontSize: 30 }}>🧪</Text>
            </View>
            <Text style={styles.welcomeTitle}>{B.welcomeTitle}</Text>
            <Text style={styles.ink}>{B.welcomeSub}</Text>
            <View style={{ gap: 16, marginTop: 8 }}>
              {steps.map(([title, body], i) => (
                <View key={title} style={{ flexDirection: "row", gap: 14 }}>
                  <View style={styles.stepNo}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.gold }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.ink, { fontFamily: fonts.bodyBold }]}>{title}</Text>
                    <Text style={[styles.ink, { fontSize: 13 }]}>{body}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.note}>{B.welcomeNote}</Text>
            <Pressable onPress={() => run("join", actions.join)} disabled={!!busy} style={styles.join}>
              <Text style={styles.joinText}>{B.welcomeYes}</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={{ alignItems: "center", paddingVertical: 12 }}>
              <Text style={[styles.ink, { fontFamily: fonts.bodyBold }]}>{B.welcomeNo}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const active = BETA_FEATURES.filter((f) => beta.features[f.key]).length;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header right={<Text style={styles.small}>{B.version}</Text>} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={styles.title}>Shussapp</Text>
          <Text style={styles.pill}>{B.pill}</Text>
        </View>
        <Text style={[styles.body, { color: colors.soft }]}>{B.intro}</Text>
        <Pressable onPress={() => router.push("/beta/stop")} style={styles.joined}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.body, { fontFamily: fonts.bodyBold }]}>{B.join}</Text>
            <Text style={styles.small}>{B.joinOn}</Text>
          </View>
          <Toggle on />
        </Pressable>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Kicker>{B.inThisBeta}</Kicker>
          <Text style={styles.small}>{format(B.activeCount, { n: active, total: BETA_FEATURES.length })}</Text>
        </View>
        {BETA_FEATURES.map((f) => {
          const copy = B.features[f.key];
          const on = beta.features[f.key];
          return (
            <View key={f.key} style={styles.card}>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                <View style={styles.tile}>
                  <Text style={{ fontSize: 22 }}>{BETA_ICON[f.key]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { fontFamily: fonts.bodyBold }]}>{copy.title}</Text>
                  <Text style={[styles.small, { fontSize: 13, lineHeight: 19, marginTop: 4 }]}>{copy.desc}</Text>
                </View>
                <Pressable
                  onPress={() => run(f.key, () => actions.setFeature(f.key, !on))}
                  disabled={busy === f.key}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={format(B.toggleLabel, { feature: copy.title })}
                  hitSlop={8}
                >
                  <Toggle on={on} />
                </Pressable>
              </View>
              <View style={styles.cardFoot}>
                <Text style={[styles.small, { flex: 1 }]}>{copy.where}</Text>
                <Pressable onPress={() => router.push({ pathname: "/beta/[feature]", params: { feature: f.key } })} hitSlop={8}>
                  <Text style={styles.link}>{`${B.explainFeedback} ›`}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <Pressable onPress={() => router.push("/beta/feedback")} style={styles.feedback}>
          <Text style={[styles.body, { color: colors.surface, fontFamily: fonts.bodyBold }]}>{B.feedbackCta}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/beta/stop")} style={{ alignItems: "center", paddingVertical: 10 }}>
          <Text style={[styles.small, { fontFamily: fonts.bodyBold, fontSize: 13 }]}>{B.stopLink}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 42, color: colors.cream, textTransform: "uppercase" },
  pill: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 10, paddingTop: 4, borderRadius: 10, overflow: "hidden" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.cream },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  joined: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 18, borderWidth: 2, borderColor: colors.gold },
  card: { borderRadius: 20, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  tile: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  cardFoot: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 },
  link: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.gold },
  feedback: { height: 56, borderRadius: 999, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", marginTop: 8 },
  welcome: { borderRadius: 28, backgroundColor: colors.gold, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, gap: 12 },
  flask: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 46, lineHeight: 46, color: colors.ink, textTransform: "uppercase", marginTop: 8 },
  ink: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  stepNo: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink, backgroundColor: "rgba(17,17,17,0.08)", borderRadius: 16, padding: 14, marginTop: 8, overflow: "hidden" },
  join: { height: 56, borderRadius: 999, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: 8 },
  joinText: { fontFamily: fonts.bodyBold, fontSize: 17, color: "#fff" },
});
