/**
 * Crew tab — Route: /crew
 *
 * The selected crew, like the website's crew page, in two sections:
 * the leaderboard (players or duos: rank, name with streak / guest chips and
 * last-5 form, W–L, win % and Elo) and the feed of recent games.
 * Pull to refresh.
 *
 * Data: GET /api/v1/crews/{crewId}, GET /api/v1/crews/{crewId}/feed
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import type { CrewDetail, FeedGame } from "@/api/types";
import { CenterState, Chip, ErrorState, FormDots, Segmented, Txt } from "@/components/ui";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { Feed } from "@/components/crew/Feed";
import { colors, fonts } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function Crew() {
  const { t } = useT();
  const { me } = useAuth();
  const { crew, version } = useCrew();
  const [section, setSection] = useState<"board" | "feed">("board");
  const [view, setView] = useState<"players" | "duos">("players");
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);
  const feed = useQuery<{ games: FeedGame[] }>(crew && section === "feed" ? `/crews/${crew.id}/feed?limit=40` : null, version);

  if (!crew) return <CenterState title={t.crews.none} body={t.app.noCrewBody} />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const { insights } = q.data;
  const userId = me?.user.id;
  const players = [...insights.players.filter((p) => p.games > 0), ...insights.players.filter((p) => p.games === 0)];
  const minDuoGames = insights.duos.filter((d) => d.games >= 2).length >= 5 ? 2 : 1;
  const duos = insights.duos.filter((d) => d.games >= minDuoGames).sort((a, b) => b.winPct - a.winPct || b.games - a.games);
  const recordStreak = Math.max(0, ...insights.duos.map((d) => d.bestWinStreak));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={q.refreshing || feed.refreshing}
            onRefresh={() => (section === "feed" ? feed.reload() : q.reload())}
            tintColor={colors.gold}
          />
        }
      >
        <View style={{ gap: 2 }}>
          <Txt v="display" numberOfLines={1} style={{ textTransform: "uppercase" }}>
            {crew.name}
          </Txt>
          <Txt style={{ color: colors.muted, fontSize: 13 }}>
            {format(t.crew.meta, { p: insights.players.filter((p) => p.games > 0).length, g: insights.totalGames })}
          </Txt>
        </View>
        <CrewSwitcher />
        <View style={styles.tabs}>
          {(["board", "feed"] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setSection(id)}
              style={[styles.tab, section === id && styles.tabOn]}
              accessibilityState={{ selected: section === id }}
            >
              <Text style={[styles.tabText, section === id && { color: colors.cream }]}>{id === "board" ? t.crew.leaderboard : t.crew.feed}</Text>
            </Pressable>
          ))}
        </View>

        {section === "feed" &&
          (feed.error && !feed.data ? (
            <ErrorState error={feed.error} onRetry={feed.reload} />
          ) : feed.data ? (
            <Feed games={feed.data.games} />
          ) : (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
          ))}

        {section === "board" && (
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "players", label: t.crew.players },
                { id: "duos", label: t.crew.duos },
              ]}
            />

            <View style={styles.table}>
              <View style={[styles.row, styles.headRow]}>
                <Txt v="label" style={styles.cRank}>
                  #
                </Txt>
                <Txt v="label" style={styles.cName}>
                  {view === "duos" ? t.crew.colDuo : t.crew.colPlayer}
                </Txt>
                <Txt v="label" style={styles.cNum}>
                  {t.crew.colWl}
                </Txt>
                <Txt v="label" style={styles.cNum}>
                  {t.crew.colWin}
                </Txt>
                <Txt v="label" style={styles.cElo}>
                  {t.crew.colElo}
                </Txt>
              </View>

              {view === "players" &&
                players.map((p, i) => {
                  const played = p.games > 0;
                  return (
                    <View key={p.userId} style={[styles.row, p.userId === userId && styles.mine]}>
                      <Txt style={[styles.cRank, styles.rank, i === 0 && played && { color: colors.gold }]}>{played ? i + 1 : "–"}</Txt>
                      <View style={[styles.cName, { gap: 3 }]}>
                        <Txt v="bodySemi" numberOfLines={1}>
                          {first(p.name)}
                        </Txt>
                        <View style={styles.chips}>
                          {p.streak?.kind === "W" && p.streak.n >= 3 && <Chip tone="hot" label={format(t.crew.streak, { n: p.streak.n })} />}
                          {p.isGuest && <Chip tone="guest" label={t.common.guest} />}
                          <FormDots form={p.form.slice(-5)} size={6} />
                        </View>
                      </View>
                      <Txt style={[styles.cNum, styles.num]}>{played ? `${p.wins}–${p.losses}` : "—"}</Txt>
                      <Txt style={[styles.cNum, styles.num, { color: colors.soft }]}>{played ? `${p.winPct}%` : ""}</Txt>
                      <Txt style={[styles.cElo, styles.elo]}>{p.elo}</Txt>
                    </View>
                  );
                })}

              {view === "duos" &&
                (duos.length === 0 ? (
                  <Txt style={{ color: colors.muted, padding: 14 }}>{t.crew.noDuos}</Txt>
                ) : (
                  duos.map((d, i) => {
                    const mine = d.a.id === userId || d.b.id === userId;
                    return (
                      <View key={d.key} style={[styles.row, mine && styles.mine]}>
                        <Txt style={[styles.cRank, styles.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Txt>
                        <View style={[styles.cName, { gap: 3 }]}>
                          <Txt v="bodySemi" numberOfLines={1}>{`${first(d.a.name)} & ${first(d.b.name)}`}</Txt>
                          {d.bestWinStreak === recordStreak && recordStreak >= 3 && <Chip tone="hot" label={format(t.crew.record, { n: recordStreak })} />}
                        </View>
                        <Txt style={[styles.cNum, styles.num]}>{`${d.wins}–${d.losses}`}</Txt>
                        <Txt style={[styles.cNum, styles.num, { color: colors.soft }]}>{`${d.winPct}%`}</Txt>
                        <Txt style={[styles.cElo, styles.elo]}>{d.duoElo}</Txt>
                      </View>
                    );
                  })
                ))}
            </View>
            {view === "duos" && minDuoGames > 1 && <Txt style={{ color: colors.muted, fontSize: 12 }}>{format(t.crew.minGames, { n: minDuoGames })}</Txt>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabOn: { borderBottomColor: colors.gold },
  tabText: { fontFamily: fonts.headBold, fontSize: 16, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  table: { borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headRow: { minHeight: 38 },
  mine: { backgroundColor: colors.raised, borderLeftWidth: 3, borderLeftColor: colors.gold },
  chips: { flexDirection: "row", alignItems: "center", gap: 5 },
  cRank: { width: 24 },
  cName: { flex: 1, minWidth: 0 },
  cNum: { width: 50, textAlign: "right" },
  cElo: { width: 50, textAlign: "right" },
  rank: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  num: { fontFamily: fonts.headSemi, fontSize: 17 },
  elo: { fontFamily: fonts.display, fontSize: 19 },
});
