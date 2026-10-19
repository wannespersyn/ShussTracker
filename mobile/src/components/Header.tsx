/**
 * Header + LinkRow
 *
 * `Header`: the back (or close) button and title used on every stacked
 * screen. `LinkRow`: a tappable settings-style row with a chevron.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useT } from "@/lib/i18n";
import { Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

export function Header({ title, close, right }: { title?: string; close?: boolean; right?: ReactNode }) {
  const { t } = useT();
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={close ? t.common.close : t.common.back} style={styles.round}>
        <Txt style={{ fontSize: close ? 16 : 20 }}>{close ? "✕" : "‹"}</Txt>
      </Pressable>
      <Txt style={styles.title} numberOfLines={1}>
        {title ?? ""}
      </Txt>
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

export function LinkRow({ label, sub, onPress, danger }: { label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <Txt v="bodySemi" style={danger ? { color: colors.redPale } : undefined}>
          {label}
        </Txt>
        {sub ? <Txt style={{ color: colors.muted, fontSize: 12 }}>{sub}</Txt> : null}
      </View>
      <Txt style={{ color: colors.muted, fontSize: 18 }}>›</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 56 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.headBold, fontSize: 20, letterSpacing: 1, textTransform: "uppercase", color: colors.cream },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
