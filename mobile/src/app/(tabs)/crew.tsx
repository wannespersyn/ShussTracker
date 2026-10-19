/**
 * Crew tab — Route: /crew
 *
 * The selected crew's leaderboard, switchable between players and duos,
 * like the website's crew page: rank, name with streak / guest chips and
 * last-5 form, W–L, win % and Elo. Pull to refresh.
 *
 * Data: GET /api/v1/crews/{crewId}
 */
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import type { CrewDetail } from "@/api/types";
import { CenterState, Chip, ErrorState, FormDots, Segmented, Txt } from "@/components/ui";
import { CrewSwitcher } from "@/components/CrewSwitcher";
import { colors, fonts } from "@/theme";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function Crew() {
  const { t } = useT();
  const { me } = useAuth();
  const { crew } = useCrew();
  const [view, setView] = useState<"players" | "duos">("players");
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null);

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
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
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
            <Txt v="label" style={styles.cRank}>#</Txt>
            <Txt v="label" style={styles.cName}>{view === "duos" ? t.crew.colDuo : t.crew.colPlayer}</Txt>
            <Txt v="label" style={styles.cNum}>{t.crew.colWl}</Txt>
            <Txt v="label" style={styles.cNum}>{t.crew.colWin}</Txt>
            <Txt v="label" style={styles.cElo}>{t.crew.colElo}</Txt>
          </View>

          {view === "players" &&
            players.map((p, i) => {
              const played = p.games > 0;
              return (
                <View key={p.userId} style={[styles.row, p.userId === userId && styles.mine]}>
                  <Txt style={[styles.cRank, styles.rank, i === 0 && played && { color: colors.gold }]}>{played ? i + 1 : "–"}</Txt>
                  <View style={[styles.cName, { gap: 3 }]}>
                    <Txt v="bodySemi" numberOfLines={1}>{first(p.name)}</Txt>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  table: { borderRadius: 18, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 52, paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
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
