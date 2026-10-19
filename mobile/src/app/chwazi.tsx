/**
 * Chwazi screen — Route: /chwazi
 *
 * The random team picker (named after the finger-picking game): choose the
 * mat and who's in, then Chwazi shuffles them into teams — or balances by
 * Elo, strongest with weakest. "Log this game" hands the teams to the Log
 * tab, which opens straight on the result step.
 *
 * Data: GET /api/v1/crews/{crewId} (roster + Elo)
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { CrewDetail } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT } from "@/lib/i18n";
import { balanceIntoDuos, pairIntoSolos, shortNamesFor, shuffleIntoDuos, type Team } from "@/lib/teams";
import { useQuery } from "@/lib/useQuery";
import { Avatar, Button, CenterState, ErrorState, Kicker, Segmented, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

type Mat = "2" | "4" | "8";
const TEAM_COLORS = [colors.gold, "#4fd1ff", colors.red, "#c6f432"];

export default function ChwaziScreen() {
  const { t } = useT();
  const { crew, version } = useCrew();
  const q = useQuery<CrewDetail>(crew ? `/crews/${crew.id}` : null, version);
  const [mat, setMat] = useState<Mat>("4");
  const [picked, setPicked] = useState<string[]>([]);
  const [balanced, setBalanced] = useState(false);
  const [phase, setPhase] = useState<"select" | "shuffling" | "result">("select");
  const [teams, setTeams] = useState<Team[] | null>(null);

  const roster = useMemo(
    () => [...(q.data?.insights.players ?? [])].sort((a, b) => b.elo - a.elo).map((p) => ({ id: p.userId, name: p.name })),
    [q.data],
  );
  const ratings = useMemo(() => Object.fromEntries((q.data?.insights.players ?? []).map((p) => [p.userId, p.elo])), [q.data]);
  const short = useMemo(() => shortNamesFor(roster), [roster]);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;

  const need = Number(mat);
  const ready = picked.length === need;
  const matName = { "2": "1 v 1", "4": "4-mat", "8": "8-mat" }[mat];

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= need ? prev : [...prev, id]));
  }

  function go() {
    if (!ready) return;
    setPhase("shuffling");
    setTimeout(() => {
      const players = roster.filter((p) => picked.includes(p.id));
      setTeams(mat === "2" ? pairIntoSolos(shuffleIntoDuos(players).flatMap((x) => x.players)) : balanced ? balanceIntoDuos(players, ratings) : shuffleIntoDuos(players));
      setPhase("result");
    }, 900);
  }

  function logIt() {
    if (!teams) return;
    router.navigate({ pathname: "/log", params: { teams: teams.flatMap((x) => x.players.map((p) => p.id)).join(",") } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.chwazi.back} style={styles.round}>
          <Txt style={{ fontSize: 20 }}>‹</Txt>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt style={styles.title}>CHWAZI</Txt>
          <Txt style={{ color: colors.muted, fontSize: 12 }}>
            {phase === "result" ? `${balanced && mat !== "2" ? t.chwazi.balanced : t.chwazi.luck} · ${matName}` : t.chwazi.sub}
          </Txt>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === "select" && (
          <>
            <Segmented
              value={mat}
              onChange={(m) => {
                setMat(m);
                setPicked((prev) => prev.slice(0, Number(m)));
              }}
              options={[
                { id: "2", label: "1 V 1" },
                { id: "4", label: "4-MAT" },
                { id: "8", label: "8-MAT" },
              ]}
            />
            <View style={styles.between}>
              <Kicker>{t.log.whoPlays}</Kicker>
              <Txt style={[styles.count, ready && { color: colors.gold }]}>{`${picked.length} / ${need}`}</Txt>
            </View>
            <View style={styles.grid}>
              {roster.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => toggle(p.id)} style={[styles.player, on && styles.playerOn]}>
                    <Avatar name={p.name} size={34} />
                    <Txt v="bodySemi" numberOfLines={1} style={{ fontSize: 13 }}>{short[p.id]}</Txt>
                    <Txt style={{ color: colors.muted, fontSize: 11 }}>{ratings[p.id]}</Txt>
                  </Pressable>
                );
              })}
            </View>
            {mat !== "2" && (
              <View style={styles.toggle}>
                <View style={{ flex: 1 }}>
                  <Txt v="bodySemi">{t.chwazi.balance}</Txt>
                  <Txt style={{ color: colors.muted, fontSize: 12 }}>{t.chwazi.balanceSub}</Txt>
                </View>
                <Switch value={balanced} onValueChange={setBalanced} trackColor={{ true: colors.gold, false: colors.chip }} thumbColor={balanced ? colors.ink : colors.muted} />
              </View>
            )}
            <Button label={ready ? "CHWAZI!" : format(t.log.pickMore, { n: need - picked.length })} disabled={!ready} onPress={go} />
          </>
        )}

        {phase === "shuffling" && <CenterState body={t.chwazi.shuffling} />}

        {phase === "result" && teams && (
          <>
            {teams.map((team, i) => {
              const color = TEAM_COLORS[i % TEAM_COLORS.length];
              const avg = Math.round(team.players.reduce((n, p) => n + (ratings[p.id] ?? 1000), 0) / team.players.length);
              return (
                <View key={team.id} style={[styles.team, { borderColor: color }]}>
                  <View style={styles.between}>
                    <Text style={[styles.teamLabel, { color }]}>{format(t.chwazi.team, { n: i + 1 })}</Text>
                    <Txt style={{ color: colors.muted, fontSize: 12 }}>{team.players.length > 1 ? `${t.duo.duoElo} ${avg}` : `Elo ${avg}`}</Txt>
                  </View>
                  {team.players.map((p) => (
                    <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Avatar name={p.name} size={34} />
                      <Txt v="bodySemi" style={{ flex: 1 }} numberOfLines={1}>{short[p.id]}</Txt>
                      <Txt style={{ color: colors.muted, fontFamily: fonts.headBold }}>{ratings[p.id]}</Txt>
                    </View>
                  ))}
                </View>
              );
            })}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label={t.chwazi.reshuffle} kind="outline" onPress={go} />
              </View>
              <View style={{ flex: 1.6 }}>
                <Button label={t.chwazi.logThis} onPress={logIt} />
              </View>
            </View>
            <Pressable onPress={() => setPhase("select")} style={{ alignSelf: "center", padding: 10 }}>
              <Txt style={{ color: colors.muted, fontFamily: fonts.bodySemi }}>{t.chwazi.change}</Txt>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 60 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  title: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1.5, color: colors.cream },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  player: {
    width: "31.5%",
    minHeight: 92,
    gap: 4,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    backgroundColor: colors.deep,
    borderWidth: 2,
    borderColor: "rgba(243,241,234,0.06)",
  },
  playerOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  team: { gap: 10, padding: 14, borderRadius: radius.xl, backgroundColor: colors.deep, borderWidth: 2 },
  teamLabel: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 2 },
});
