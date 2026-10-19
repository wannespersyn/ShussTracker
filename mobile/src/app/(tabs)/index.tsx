/**
 * Home tab — Route: /
 *
 * The signed-in player's scoreboard in the selected crew: crew rank, Elo
 * and this week's change, streak, win % / games / mama, last 10 results,
 * the last session and the crew's top 3. Pull to refresh.
 *
 * Data: GET /api/v1/crews/{crewId}
 */
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import type { CrewDetail } from "@/api/types";
import { Avatar, Card, CenterState, Chip, ErrorState, FormDots, Kicker, StatTile, Txt } from "@/components/ui";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { NoCrew } from "@/components/crew/NoCrew";
import { colors, fonts } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function Home() {
  const { t } = useT();
  const { me } = useAuth();
  const { crew, version } = useCrew();
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);

  if (!crew) return <NoCrew />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const { insights } = q.data;
  const userId = me?.user.id;
  const ranked = insights.players.filter((p) => p.games > 0);
  const mine = insights.players.find((p) => p.userId === userId);
  const last = insights.sessions[0];
  const myLine = last?.lines.find((l) => l.userId === userId);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        <View style={styles.header}>
          <Txt style={styles.brand}>SHUSSAPP</Txt>
          <Txt v="label">{crew.name}</Txt>
        </View>
        <CrewSwitcher />

        {!mine || mine.games === 0 ? (
          <Card>
            <Txt v="heading">{t.home.noGamesTitle}</Txt>
            <Txt style={{ color: colors.muted, marginTop: 4 }}>{t.home.noGamesBody}</Txt>
          </Card>
        ) : (
          <>
            <Card raised style={styles.hero}>
              <Kicker>{format(t.home.crewRank, { y: new Date().getFullYear() })}</Kicker>
              <View style={styles.heroRow}>
                <Txt style={styles.rank}>#{mine.rank}</Txt>
                <Txt style={styles.of}>{format(t.home.of, { n: ranked.length })}</Txt>
                <View style={{ flex: 1 }} />
                <View style={{ alignItems: "flex-end" }}>
                  <Txt v="label">{t.home.elo}</Txt>
                  <Txt style={styles.elo}>{mine.elo}</Txt>
                  {mine.eloWeek !== 0 && (
                    <Txt style={{ color: mine.eloWeek > 0 ? colors.mint : colors.red, fontFamily: fonts.headBold }}>
                      {format(t.home.thisWeek, { d: `${mine.eloWeek > 0 ? "▲" : "▼"}${Math.abs(mine.eloWeek)}` })}
                    </Txt>
                  )}
                </View>
              </View>
              {mine.streak && mine.streak.n >= 3 && (
                <Chip
                  tone={mine.streak.kind === "W" ? "hot" : "neutral"}
                  label={format(mine.streak.kind === "W" ? t.home.winStreak : t.home.loseStreak, { n: mine.streak.n })}
                />
              )}
            </Card>

            <View style={styles.stats}>
              <StatTile label={t.home.winPct} value={`${mine.winPct}%`} tone="gold" />
              <StatTile label={t.home.games} value={mine.games} />
              <StatTile label={t.home.mama} value={mine.mama} tone="red" />
            </View>

            <Card style={{ gap: 10 }}>
              <Kicker>{t.home.last10}</Kicker>
              <FormDots form={mine.form} size={14} />
            </Card>
          </>
        )}

        {last && (
          <Card style={{ gap: 6 }}>
            <Kicker>{format(t.home.lastSession, { n: last.games })}</Kicker>
            {last.mvp && (
              <Txt v="bodySemi">
                {last.mvp.userId === userId
                  ? format(t.home.youMvp, { w: last.mvp.wins })
                  : format(t.home.mvpWas, { name: first(last.mvp.name), w: last.mvp.wins })}
              </Txt>
            )}
            {myLine && last.mvp?.userId !== userId && (
              <Txt style={{ color: colors.muted }}>{format(t.home.youPlayed, { w: myLine.wins, g: myLine.games })}</Txt>
            )}
          </Card>
        )}

        {ranked.length > 0 && (
          <Card style={{ gap: 10 }}>
            <Kicker>{format(t.home.top3, { crew: crew.name })}</Kicker>
            {ranked.slice(0, 3).map((p, i) => (
              <Pressable
                key={p.userId}
                onPress={() => router.push({ pathname: "/player/[id]", params: { id: p.userId } })}
                style={({ pressed }) => [styles.topRow, pressed && { opacity: 0.7 }]}
              >
                <Txt style={[styles.topRank, i === 0 && { color: colors.gold }]}>{i + 1}</Txt>
                <Avatar name={p.name} size={32} />
                <Txt v="bodySemi" style={{ flex: 1 }} numberOfLines={1}>
                  {p.userId === userId ? t.common.you : first(p.name)}
                </Txt>
                <Txt style={styles.topElo}>{p.elo}</Txt>
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 40 },
  brand: { fontFamily: fonts.headBold, fontSize: 22, letterSpacing: 1.3, color: colors.cream },
  hero: { gap: 10 },
  heroRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rank: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, color: colors.gold },
  of: { fontFamily: fonts.headSemi, fontSize: 18, color: colors.muted, marginBottom: 8 },
  elo: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, lineHeight: 36 },
  stats: { flexDirection: "row", gap: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topRank: { width: 18, fontFamily: fonts.display, fontSize: 20, color: colors.muted },
  topElo: { fontFamily: fonts.display, fontSize: 20, color: colors.cream },
});
