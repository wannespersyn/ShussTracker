/**
 * UI building blocks
 *
 * The app's version of the website's v2 "scoreboard" components: text
 * styles, cards, buttons, chips, form dots, avatars, a crew switcher and
 * the shared loading / error / empty states.
 *
 * Exports: Txt, Kicker, Card, Button, Chip, FormDots, Avatar, StatTile,
 *          Segmented, CenterState, ErrorState
 */
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, fonts, radius } from "@/theme";
import { useT } from "@/lib/i18n";
import type { ApiError } from "@/api/client";

type Variant = "body" | "bodySemi" | "heading" | "display" | "label";
const variantStyle: Record<Variant, TextStyle> = {
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.cream },
  heading: { fontFamily: fonts.headBold, fontSize: 22, color: colors.cream, letterSpacing: 0.5, textTransform: "uppercase" },
  display: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, lineHeight: 36 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted, letterSpacing: 0.9, textTransform: "uppercase" },
};

export function Txt({ v = "body", style, ...props }: TextProps & { v?: Variant }) {
  return <Text {...props} style={[variantStyle[v], style]} />;
}

export function Kicker({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.kicker, style]}>{children}</Text>;
}

export function Card({ children, style, raised }: { children: ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean }) {
  return <View style={[styles.card, raised && { backgroundColor: colors.raised }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}) {
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.gold } : kind === "outline" ? { borderWidth: 1.5, borderColor: colors.lineStrong } : null,
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.ink : colors.cream} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.ink : colors.cream }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "hot" | "guest" | "info" }) {
  const toneStyle: Record<string, ViewStyle> = {
    neutral: { backgroundColor: colors.chip },
    hot: { backgroundColor: "rgba(255,107,91,0.18)" },
    guest: { backgroundColor: colors.chip },
    info: { backgroundColor: "rgba(79,209,255,0.15)" },
  };
  const color = tone === "hot" ? colors.redPale : tone === "info" ? "#4fd1ff" : colors.soft;
  return (
    <View style={[styles.chip, toneStyle[tone]]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function FormDots({ form, size = 7 }: { form: ("W" | "L")[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {form.map((r, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: r === "W" ? colors.gold : colors.chip }} />
      ))}
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.headBold, fontSize: size * 0.38, color: colors.soft }}>{initials}</Text>
    </View>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "gold" | "red" }) {
  return (
    <View style={styles.statTile}>
      <Txt v="label" numberOfLines={1}>
        {label}
      </Txt>
      <Text style={[styles.statValue, tone === "gold" && { color: colors.gold }, tone === "red" && { color: colors.red }]}>{value}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.segment, active && { backgroundColor: colors.gold }]} accessibilityState={{ selected: active }}>
            <Text style={[styles.segmentText, { color: active ? colors.ink : colors.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CenterState({ title, body, children }: { title?: string; body?: string; children?: ReactNode }) {
  return (
    <View style={styles.center}>
      {title ? <Txt v="display" style={{ fontSize: 28, textAlign: "center" }}>{title}</Txt> : <ActivityIndicator color={colors.gold} />}
      {body ? <Txt style={{ color: colors.muted, textAlign: "center", maxWidth: 300 }}>{body}</Txt> : null}
      {children}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const { t } = useT();
  return (
    <CenterState title="—" body={error.status === 0 ? t.app.offline : error.message}>
      <View style={{ width: 200, marginTop: 8 }}>
        <Button label={t.app.retry} onPress={onRetry} kind="outline" />
      </View>
    </CenterState>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.headSemi, fontSize: 12, letterSpacing: 1.7, textTransform: "uppercase", color: colors.muted },
  card: { backgroundColor: colors.deep, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 },
  button: { height: 54, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontFamily: fonts.headBold, fontSize: 19, letterSpacing: 1, textTransform: "uppercase" },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  chipText: { fontFamily: fonts.headBold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  statTile: { flex: 1, backgroundColor: colors.deep, paddingHorizontal: 10, paddingVertical: 12, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.cream },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  segment: { flex: 1, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 0.6, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
});
