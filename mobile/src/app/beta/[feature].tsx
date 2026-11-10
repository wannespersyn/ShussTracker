/**
 * Beta feature explainer — Route: /beta/[feature]
 *
 * What one beta feature does, where to find it and for who, the notes,
 * a "try it" button, a quick thumbs up / down and a link to the full
 * feedback sheet. Same copy as the website.
 *
 * Data: POST /api/v1/beta/feedback (thumbs = rating 4 / 1)
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { BetaKey } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { BETA_FEATURES, BETA_ICON, tryBeta, useBetaActions } from "@/lib/beta";
import { Button, CenterState, Kicker } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

export default function BetaFeature() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const { t } = useT();
  const B = t.beta;
  const actions = useBetaActions();
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const f = BETA_FEATURES.find((x) => x.key === feature);
  if (!f) return <CenterState title="—" />;
  const key = f.key as BetaKey;
  const copy = B.features[key];

  async function rate(up: boolean) {
    setRated(up ? "up" : "down");
    await actions.feedback({ feature: key, rating: up ? 4 : 1 }).catch(() => null);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tile}>
          <Text style={{ fontSize: 34 }}>{BETA_ICON[key]}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.pill}>{B.pill}</Text>
        </View>
        <Text style={styles.body}>{copy.about}</Text>
        <View style={styles.meta}>
          <View style={{ flex: 1 }}>
            <Kicker>{B.where}</Kicker>
            <Text style={styles.body}>{copy.where}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Kicker>{B.forWho}</Kicker>
            <Text style={styles.body}>{copy.forWho}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Kicker>{copy.notesTitle}</Kicker>
          {copy.notes.split("\n").map((line) => (
            <View key={line} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ color: colors.gold }}>•</Text>
              <Text style={[styles.body, { flex: 1, fontSize: 14 }]}>{line}</Text>
            </View>
          ))}
        </View>
        <Button label={B.tryIt} onPress={() => tryBeta(key)} />
        <View style={styles.card}>
          <Text style={[styles.body, { fontFamily: fonts.bodyBold }]}>{format(B.rateQuestion, { feature: copy.title })}</Text>
          {rated ? (
            <Pressable onPress={() => router.push({ pathname: "/beta/feedback", params: { feature: key } })}>
              <Text style={styles.link}>{B.rateThanks}</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => rate(true)} style={styles.rate}>
                <Text style={styles.rateText}>{`👍 ${B.rateUp}`}</Text>
              </Pressable>
              <Pressable onPress={() => rate(false)} style={styles.rate}>
                <Text style={styles.rateText}>{`👎 ${B.rateDown}`}</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => router.push({ pathname: "/beta/feedback", params: { feature: key } })}>
            <Text style={styles.link}>{B.writeMore}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  tile: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, textTransform: "uppercase", flexShrink: 1 },
  pill: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.soft },
  meta: { flexDirection: "row", gap: 12 },
  card: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  rate: { flex: 1, height: 46, borderRadius: 14, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  rateText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.cream },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.gold },
});
