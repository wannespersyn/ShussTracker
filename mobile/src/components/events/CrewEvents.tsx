/**
 * CrewEvents
 *
 * A crew's tournaments as rows — brackets and Americano / Mexicano — with a
 * LIVE badge for running ones and the winner for finished ones, plus the
 * two "start one" buttons. Same as the website's components/crews/CrewEvents.
 *
 * Exports: CrewEventRow, NewEventButtons, openEvent
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { CrewEvent } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

export function openEvent(e: Pick<CrewEvent, "kind" | "id">) {
  if (e.kind === "rotation") router.push({ pathname: "/americano/[id]", params: { id: e.id } });
  else router.push({ pathname: "/tournaments/[id]", params: { id: e.id } });
}

export function CrewEventRow({ e }: { e: CrewEvent }) {
  const { t, locale } = useT();
  const date = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" }).format(new Date(e.createdAt));
  return (
    <Pressable onPress={() => openEvent(e)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <View style={[styles.icon, e.live && { backgroundColor: "rgba(255,182,39,0.14)" }]}>
        <Text style={{ fontSize: 18, color: e.live ? colors.gold : colors.muted }}>{e.kind === "rotation" ? "⇄" : "🏆"}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="bodySemi" numberOfLines={1}>
          {e.name}
        </Txt>
        <Txt numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>
          {(e.champion ? `${format(t.ev.won, { name: e.champion })} · ` : "") + format(t.ev.meta, { format: t.ev[e.format], n: e.players, date })}
        </Txt>
      </View>
      {e.live && (
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{t.ev.live}</Text>
        </View>
      )}
      <Txt style={{ color: colors.muted, fontSize: 18 }}>›</Txt>
    </Pressable>
  );
}

export function NewEventButtons({ crewId }: { crewId: string }) {
  const { t } = useT();
  const items = [
    { label: t.ev.newBracket, sub: t.ev.newBracketSub, go: () => router.push({ pathname: "/tournaments/new", params: { crewId } }) },
    { label: t.ev.newRotation, sub: t.ev.newRotationSub, go: () => router.push({ pathname: "/americano/new", params: { crewId } }) },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((x) => (
        <Pressable key={x.label} onPress={x.go} style={({ pressed }) => [styles.new, pressed && { opacity: 0.8 }]}>
          <Text style={styles.newLabel}>{`+ ${x.label}`}</Text>
          <Txt style={{ fontSize: 12, color: colors.muted, lineHeight: 16 }}>{x.sub}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  live: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.red },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  liveText: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 1.4, color: colors.ink },
  new: { flex: 1, gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,182,39,0.45)" },
  newLabel: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 1.1, color: colors.gold },
});
