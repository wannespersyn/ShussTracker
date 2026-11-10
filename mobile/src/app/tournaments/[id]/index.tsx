/**
 * Tournament — Route: /tournaments/[id]
 *
 * A tournament as on the website, laid out for a phone: live / done badge,
 * the champion, the next playable match with a play button, then the
 * bracket round by round (winners, losers, grand final) or the round-robin
 * standings and rounds. Tapping a playable match plays it.
 *
 * Data: GET /api/v1/tournaments/{id}
 */
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { Tournament, TournamentEntrant, TournamentMatch } from "@/api/types";
import { useCrew } from "@/lib/crew";
import { format, useT, type Dictionary } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Button, Card, CenterState, ErrorState, Kicker, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts, radius } from "@/theme";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (e: TournamentEntrant | null, tbd: string) =>
  e
    ? e.names
        .split(" & ")
        .map((n) => cap(n.trim().split(/\s+/)[0] ?? n))
        .join(" & ")
    : tbd;

function roundName(i: number, total: number, T: Dictionary["tour"]) {
  return i === total - 1 ? T.finalUp : i === total - 2 ? T.semisUp : i === total - 3 ? T.quartersUp : format(T.roundUp, { n: i + 1 });
}

type MatchProps = { m: TournamentMatch; final?: boolean; T: Dictionary["tour"]; onPlay: (m: TournamentMatch) => void };

function Match({ m, final, T, onPlay }: MatchProps) {
  const playable = !!(m.entrantA && m.entrantB && !m.gameId);
  const side = (e: TournamentEntrant | null) => {
    const win = m.winnerEntrantId ? m.winnerEntrantId === e?.id : null;
    return (
      <View style={[styles.side, win === true && { backgroundColor: colors.gold }, win === false && { opacity: 0.55 }]}>
        <Txt v="bodySemi" numberOfLines={1} style={[{ flex: 1, fontSize: 14 }, win === true && { color: colors.ink }, !e && { color: colors.muted }]}>
          {short(e, T.tbd)}
        </Txt>
        <Text style={[styles.wl, win === true && { color: colors.ink }]}>{win === true ? "W" : win === false ? "L" : "—"}</Text>
      </View>
    );
  };
  return (
    <Pressable
      disabled={!playable}
      onPress={() => onPlay(m)}
      style={[styles.match, final && { borderColor: colors.gold, borderWidth: 2 }, playable && { borderColor: "rgba(255,182,39,0.5)" }]}
    >
      {side(m.entrantA)}
      <View style={{ height: 1, backgroundColor: colors.line }} />
      {side(m.entrantB)}
    </Pressable>
  );
}

function Bracket({ rounds, title, T, onPlay }: { rounds: TournamentMatch[][]; title?: string; T: Dictionary["tour"]; onPlay: (m: TournamentMatch) => void }) {
  if (rounds.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {title && <Kicker>{title}</Kicker>}
      {rounds.map((round, i) => (
        <View key={i} style={{ gap: 6 }}>
          <Txt style={[styles.roundLabel, i === rounds.length - 1 && { color: colors.gold }]}>{roundName(i, rounds.length, T)}</Txt>
          {round.map((m) => (
            <Match key={m.id} m={m} final={i === rounds.length - 1} T={T} onPlay={onPlay} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const T = t.tour;
  const { version } = useCrew();
  const q = useQuery<{ tournament: Tournament }>(`/tournaments/${id}`, version);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const tr = q.data.tournament;
  const live = tr.status !== "completed";

  const all: { m: TournamentMatch; label: string }[] = [
    ...tr.winnersRounds.flatMap((r, i, rs) => r.map((m) => ({ m, label: roundName(i, rs.length, T) }))),
    ...tr.losersRounds.flatMap((r, i) => r.map((m) => ({ m, label: format(T.losersRound, { n: i + 1 }) }))),
    ...(tr.grandFinal ? [{ m: tr.grandFinal, label: T.grandFinal }] : []),
    ...tr.roundRobinRounds.flatMap((r, i) => r.map((m) => ({ m, label: format(T.round, { n: i + 1 }) }))),
  ];
  const upNext = all.find((x) => x.m.entrantA && x.m.entrantB && !x.m.gameId);
  const duos = new Set(all.flatMap((x) => [x.m.entrantA?.id, x.m.entrantB?.id]).filter(Boolean)).size;
  const play = (m: TournamentMatch) => router.push({ pathname: "/tournaments/[id]/match/[matchId]", params: { id: tr.id, matchId: m.id } });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Header title={tr.name} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} tintColor={colors.gold} />}
      >
        <View style={styles.between}>
          <Txt style={{ color: colors.muted, flex: 1 }} numberOfLines={2}>
            {format(T.meta, {
              format: { single_elim: T.formatSingle, double_elim: T.formatDouble, round_robin: T.formatRobin }[tr.format],
              n: duos,
              crew: tr.groupName,
            })}
          </Txt>
          <Text style={[styles.badge, live ? { backgroundColor: colors.red } : { backgroundColor: colors.raised, color: colors.muted }]}>
            {live ? T.live : T.done}
          </Text>
        </View>

        {tr.championEntrant && (
          <View style={styles.champion}>
            <Text style={{ fontSize: 36 }}>🏆</Text>
            <View>
              <Txt style={{ fontFamily: fonts.headBold, color: colors.ink, letterSpacing: 2, fontSize: 13 }}>{T.champions}</Txt>
              <Txt style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink, textTransform: "uppercase" }}>{short(tr.championEntrant, T.tbd)}</Txt>
            </View>
          </View>
        )}

        {upNext && (
          <Card raised style={{ gap: 10, borderColor: "rgba(255,182,39,0.4)" }}>
            <Kicker>{format(T.upNextLabel, { label: upNext.label })}</Kicker>
            <View style={styles.between}>
              <Txt style={styles.vsName} numberOfLines={1}>
                {short(upNext.m.entrantA, T.tbd)}
              </Txt>
              <Txt style={{ fontFamily: fonts.display, color: "#5b6460" }}>{T.vs}</Txt>
              <Txt style={[styles.vsName, { textAlign: "right" }]} numberOfLines={1}>
                {short(upNext.m.entrantB, T.tbd)}
              </Txt>
            </View>
            <Button label={T.play} onPress={() => play(upNext.m)} />
          </Card>
        )}

        {tr.format === "round_robin" ? (
          <>
            <Card style={{ gap: 6 }}>
              <Kicker>{T.standings}</Kicker>
              {tr.standings.map((row, i) => (
                <View key={row.entrant.id} style={styles.between}>
                  <Txt style={[styles.rank, i === 0 && { color: colors.gold }]}>{i + 1}</Txt>
                  <Txt v="bodySemi" style={{ flex: 1 }} numberOfLines={1}>
                    {short(row.entrant, T.tbd)}
                  </Txt>
                  <Txt style={{ fontFamily: fonts.headBold }}>{`${row.wins}–${row.played - row.wins}`}</Txt>
                </View>
              ))}
            </Card>
            {tr.roundRobinRounds.map((round, i) => (
              <View key={i} style={{ gap: 6 }}>
                <Kicker>{format(T.round, { n: i + 1 })}</Kicker>
                {round.map((m) => (
                  <Match key={m.id} m={m} T={T} onPlay={play} />
                ))}
              </View>
            ))}
          </>
        ) : (
          <>
            <Bracket rounds={tr.winnersRounds} title={tr.format === "double_elim" ? T.winners : undefined} T={T} onPlay={play} />
            {tr.format === "double_elim" && <Bracket rounds={tr.losersRounds} title={T.losers} T={T} onPlay={play} />}
            {tr.grandFinal && (
              <View style={{ gap: 6 }}>
                <Kicker style={{ color: colors.gold }}>{T.grandFinal}</Kicker>
                <Match m={tr.grandFinal} final T={T} onPlay={play} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badge: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  champion: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.xl, backgroundColor: colors.gold },
  vsName: { flex: 1, fontFamily: fonts.headBold, fontSize: 19, color: colors.cream, textTransform: "uppercase" },
  rank: { width: 22, fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  roundLabel: { fontFamily: fonts.headSemi, fontSize: 12, letterSpacing: 1.6, color: colors.muted },
  match: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: "rgba(243,241,234,0.1)", backgroundColor: colors.raised },
  side: { flexDirection: "row", alignItems: "center", gap: 8, height: 42, paddingHorizontal: 12 },
  wl: { fontFamily: fonts.display, fontSize: 15, color: colors.muted },
});
