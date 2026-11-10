/**
 * Duos tab — Route: /duos
 *
 * Your duos in the selected crew, like the website's duo page: pick a
 * partner, then see your record together, duo rank, win %, best run, duo
 * Elo, who carries the mama hits and your recent games (tap to open).
 *
 * Data: GET /api/v1/crews/{crewId} (insights.duos)
 */
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthProvider";
import type { CrewDetail } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { wilsonLowerBound } from "@/lib/ranking";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Card, CenterState, ErrorState, Kicker, StatTile, Txt } from "@/components/ui";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { NoCrew } from "@/components/crew/NoCrew";
import { colors, fonts, radius } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const ordinal = (n: number, locale: string) => {
  if (locale === "nl") return `${n}e`;
  const r100 = n % 100;
  const suffix = r100 >= 11 && r100 <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
};

export default function DuosTab() {
  const { t, locale } = useT();
  const { me } = useAuth();
  const { crew, version } = useCrew();
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  if (!crew) return <NoCrew />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const userId = me?.user.id;
  const { duos } = q.data.insights;
  const mine = duos.filter((d) => d.a.id === userId || d.b.id === userId).sort((a, b) => b.games - a.games || b.wins - a.wins);
  const partnerOf = (d: (typeof mine)[number]) => (d.a.id === userId ? d.b : d.a);
  const duo = mine.find((d) => partnerOf(d).id === partnerId) ?? mine[0];

  const body = !duo ? (
    <Card>
      <Txt style={{ color: colors.muted }}>{t.duo.empty}</Txt>
    </Card>
  ) : (
    (() => {
      const partner = partnerOf(duo);
      const myMama = duo.a.id === userId ? duo.mamaA : duo.mamaB;
      const theirMama = duo.a.id === userId ? duo.mamaB : duo.mamaA;
      const totalMama = myMama + theirMama;
      const ranking = duos
        .filter((d) => d.games >= Math.min(5, duo.games))
        .sort((a, b) => wilsonLowerBound(b.wins, b.games) - wilsonLowerBound(a.wins, a.games));
      const duoRank = ranking.findIndex((d) => d.key === duo.key) + 1;
      const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
      return (
        <>
          <Card raised style={{ gap: 12 }}>
            <View style={styles.row}>
              <View style={styles.pair}>
                <Avatar name={me?.user.name ?? "?"} size={40} />
                <View style={{ marginLeft: -12 }}>
                  <Avatar name={partner.name} size={40} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.duoName} numberOfLines={1}>{`${t.common.you} & ${first(partner.name)}`}</Txt>
                <Txt style={{ color: colors.muted, fontSize: 13 }}>{format(t.duo.gamesTogether, { n: duo.games })}</Txt>
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Kicker>{t.duo.record}</Kicker>
                <Text style={styles.record}>
                  <Text style={{ color: colors.gold }}>{duo.wins}</Text>
                  <Text style={{ color: "#5b6460" }}>–</Text>
                  {duo.losses}
                </Text>
              </View>
              {duoRank > 0 && (
                <View style={{ alignItems: "flex-end" }}>
                  <Kicker>{t.duo.duoRank}</Kicker>
                  <Text style={[styles.record, { fontSize: 38, color: colors.gold }]}>{`#${duoRank}`}</Text>
                </View>
              )}
            </View>
          </Card>

          <View style={styles.stats}>
            <StatTile label={t.home.winPct} value={`${duo.winPct}%`} />
            <StatTile label={t.duo.bestRun} value={`${duo.bestWinStreak} W`} />
            <StatTile label={t.duo.duoElo} value={duo.duoElo} tone="gold" />
          </View>

          {totalMama > 0 && (
            <Card style={{ gap: 8 }}>
              <View style={styles.between}>
                <Kicker>{t.duo.whoCarries}</Kicker>
                <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(t.duo.together, { n: totalMama })}</Txt>
              </View>
              <View style={styles.bar}>
                <View style={{ flex: myMama || 0.0001, backgroundColor: colors.red }} />
                <View style={{ flex: theirMama || 0.0001, backgroundColor: colors.chip }} />
              </View>
              <View style={styles.between}>
                <Txt style={{ fontFamily: fonts.headBold, color: colors.red }}>{`${t.common.you} · ${myMama}`}</Txt>
                <Txt style={{ fontFamily: fonts.headBold, color: colors.soft }}>{`${first(partner.name)} · ${theirMama}`}</Txt>
              </View>
            </Card>
          )}

          {duo.recent.length > 0 && (
            <View style={{ gap: 6 }}>
              <Kicker>{t.duo.recent}</Kicker>
              {duo.recent.map((g) => (
                <Pressable
                  key={g.gameId}
                  onPress={() => router.push({ pathname: "/game/[id]", params: { id: g.gameId } })}
                  style={({ pressed }) => [styles.game, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.wl, { backgroundColor: g.won ? colors.gold : colors.chip }]}>
                    <Text style={[styles.wlText, { color: g.won ? colors.ink : colors.soft }]}>{g.won ? "W" : "L"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodySemi" numberOfLines={1} style={{ fontSize: 14 }}>{`vs ${g.opponents}`}</Txt>
                    <Txt style={{ color: colors.muted, fontSize: 11 }}>
                      {`${dateFmt.format(new Date(g.playedAt))}${g.mama > 0 ? ` · ${format(t.feed.mamaN, { n: g.mama })}` : ""}`}
                    </Txt>
                  </View>
                  {g.won && g.streakAfter >= 2 && (
                    <Txt style={{ fontFamily: fonts.headBold, color: colors.mint }}>{format(t.duo.winN, { n: ordinal(g.streakAfter, locale) })}</Txt>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </>
      );
    })()
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        <Txt v="display" style={{ textTransform: "uppercase" }}>
          {t.duo.title}
        </Txt>
        <CrewSwitcher />
        {mine.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {mine.map((d) => {
              const p = partnerOf(d);
              const active = d.key === duo?.key;
              return (
                <Pressable key={d.key} onPress={() => setPartnerId(p.id)} style={[styles.partner, active && styles.partnerOn]}>
                  <Avatar name={p.name} size={30} />
                  <View>
                    <Txt v="bodySemi" style={{ fontSize: 14 }}>
                      {first(p.name)}
                    </Txt>
                    <Txt style={{ color: colors.muted, fontSize: 11 }}>{`${d.wins}–${d.losses}`}</Txt>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pair: { flexDirection: "row" },
  duoName: { fontFamily: fonts.headBold, fontSize: 22, color: colors.cream, textTransform: "uppercase" },
  record: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.cream },
  stats: { flexDirection: "row", gap: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  bar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  game: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.deep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  wl: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  wlText: { fontFamily: fonts.display, fontSize: 15 },
  partner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.deep,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  partnerOn: { borderColor: colors.gold, backgroundColor: colors.raised },
});
