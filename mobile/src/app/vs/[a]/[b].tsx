/**
 * Head-to-head — Route: /vs/[a]/[b]
 *
 * Two players against each other: wins each way, win % / mama per game /
 * Elo / games compared as bars, and their last meetings (tap to open).
 * "Rematch" sends both into the log flow on a 1v1.
 *
 * Data: GET /api/v1/players/{a}/vs/{b}
 */
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { HeadToHead } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, Card, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

const first = (n: string | null) => (n ?? "?").trim().split(/\s+/)[0] ?? "?";

export default function VsScreen() {
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const { t, locale } = useT();
  const { version } = useCrew();
  const q = useQuery<HeadToHead>(`/players/${a}/vs/${b}`, version);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const d = q.data;
  const pa = d.a.stats;
  const pb = d.b.stats;
  const rows = [
    { label: t.h2h.winPct, x: pa?.winPct ?? 0, y: pb?.winPct ?? 0, fa: `${pa?.winPct ?? 0}%`, fb: `${pb?.winPct ?? 0}%` },
    {
      label: t.h2h.mamaGame,
      x: pa?.games ? pa.mama / pa.games : 0,
      y: pb?.games ? pb.mama / pb.games : 0,
      fa: pa?.games ? (pa.mama / pa.games).toFixed(2) : "0.00",
      fb: pb?.games ? (pb.mama / pb.games).toFixed(2) : "0.00",
    },
    { label: t.h2h.elo, x: pa?.elo ?? 1000, y: pb?.elo ?? 1000, fa: String(pa?.elo ?? "—"), fb: String(pb?.elo ?? "—") },
    { label: t.h2h.games, x: pa?.games ?? 0, y: pb?.games ?? 0, fa: String(pa?.games ?? 0), fb: String(pb?.games ?? 0) },
  ];
  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "2-digit", month: "2-digit" });
  const total = d.aWins + d.bWins;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title={t.h2h.title} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        <Card raised style={styles.hero}>
          <View style={styles.side}>
            <Avatar name={d.a.name ?? "?"} size={52} />
            <Txt v="bodySemi" numberOfLines={1}>
              {first(d.a.name)}
            </Txt>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.score}>
              <Text style={{ color: d.aWins >= d.bWins ? colors.gold : colors.cream }}>{d.aWins}</Text>
              <Text style={{ color: "#5b6460" }}>–</Text>
              <Text style={{ color: d.bWins > d.aWins ? colors.gold : colors.cream }}>{d.bWins}</Text>
            </Text>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(t.h2h.meetings, { n: total })}</Txt>
          </View>
          <View style={styles.side}>
            <Avatar name={d.b.name ?? "?"} size={52} />
            <Txt v="bodySemi" numberOfLines={1}>
              {first(d.b.name)}
            </Txt>
          </View>
        </Card>

        {d.crew && (
          <Card style={{ gap: 12 }}>
            {rows.map((r) => {
              const sum = r.x + r.y || 1;
              return (
                <View key={r.label} style={{ gap: 4 }}>
                  <View style={styles.between}>
                    <Txt style={styles.val}>{r.fa}</Txt>
                    <Txt v="label">{r.label}</Txt>
                    <Txt style={styles.val}>{r.fb}</Txt>
                  </View>
                  <View style={styles.bar}>
                    <View style={{ flex: r.x / sum || 0.0001, backgroundColor: r.x >= r.y ? colors.gold : colors.chip }} />
                    <View style={{ flex: r.y / sum || 0.0001, backgroundColor: r.y > r.x ? colors.gold : colors.chip }} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <Kicker>{t.h2h.last}</Kicker>
        {d.meetings.length === 0 && <Txt style={{ color: colors.muted }}>{t.h2h.none}</Txt>}
        {d.meetings.slice(0, 10).map((m) => (
          <Pressable
            key={m.gameId}
            onPress={() => router.push({ pathname: "/game/[id]", params: { id: m.gameId } })}
            style={({ pressed }) => [styles.meeting, pressed && { opacity: 0.7 }]}
          >
            <Txt style={{ color: colors.muted, width: 48 }}>{dateFmt.format(new Date(m.playedAt))}</Txt>
            <Txt v="bodySemi" style={{ flex: 1, color: m.aWon ? colors.gold : colors.cream }}>
              {m.aWon ? first(d.a.name) : first(d.b.name)}
            </Txt>
            <Txt style={{ color: colors.muted, fontSize: 12 }}>{m.matType === "2" ? "1V1" : `${m.matType}-MAT`}</Txt>
          </Pressable>
        ))}

        <Button label={t.h2h.rematch} kind="outline" onPress={() => router.navigate({ pathname: "/log", params: { teams: `${a},${b}` } })} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { alignItems: "center", gap: 6, width: 90 },
  score: { fontFamily: fonts.display, fontSize: 52, lineHeight: 54, color: colors.cream },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  val: { fontFamily: fonts.headBold, fontSize: 16, color: colors.cream, width: 60 },
  bar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 },
  meeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
