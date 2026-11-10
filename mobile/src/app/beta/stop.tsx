/**
 * Leave the beta — Route: /beta/stop
 *
 * "Leave the beta?": what disappears, that games and stats stay, an
 * optional reason, then leave (or stay). Like the website.
 *
 * Data: PATCH /api/v1/me/beta { optIn: false, reason }
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { BetaKey } from "@/api/types";
import { useT } from "@/lib/i18n";
import { BETA_FEATURES, BETA_LEAVE_REASONS, useBetaActions } from "@/lib/beta";
import { Button, Kicker } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

export default function LeaveBeta() {
  const { t } = useT();
  const B = t.beta;
  const actions = useBetaActions();
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    await actions.leave(reason ?? undefined).catch(() => null);
    setBusy(false);
    router.dismissTo("/me");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Header close />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{B.stopTitle}</Text>
        <Text style={styles.body}>{B.stopBody}</Text>
        <View style={styles.card}>
          {BETA_FEATURES.map((f) => (
            <Text key={f.key} style={styles.body}>{`• ${B.features[f.key as BetaKey].title}`}</Text>
          ))}
        </View>
        <Text style={[styles.body, { color: colors.mint }]}>{B.stopSafe}</Text>
        <Kicker>{B.stopWhy}</Kicker>
        {BETA_LEAVE_REASONS.map((r) => {
          const on = reason === r;
          return (
            <Pressable key={r} onPress={() => setReason(on ? null : r)} style={[styles.reason, on && { borderColor: colors.gold }]}>
              <View style={[styles.radio, on && { borderColor: colors.gold }]}>{on && <View style={styles.dot} />}</View>
              <Text style={[styles.body, { color: colors.cream }]}>{B.reasons[r]}</Text>
            </Pressable>
          );
        })}
        <Button label={B.stopCta} kind="outline" loading={busy} onPress={leave} />
        <Button label={B.stopStay} onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.cream, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.soft },
  card: { gap: 6, padding: 16, borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  reason: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 2, borderColor: "transparent" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#6e6e6a", alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
});
