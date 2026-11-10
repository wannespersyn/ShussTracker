/**
 * Shussapp Wrapped (beta) — Route: /wrapped?crewId=
 *
 * The season story for the signed-in player in one crew, like the website:
 * in 2+ crews you pick the crew first; fewer than 10 season games → "play N
 * more"; otherwise 7 auto-advancing slides — intro, games, golden duo,
 * shuss hour, photo highlights, play style and the share card. Tap right /
 * left to skip, pause in the header. Not in the beta → its explainer.
 *
 * Data: GET /api/v1/crews/{crewId}/wrapped
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { apiUrl, authHeaders } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import type { WrappedType } from "@shared/wrapped";
import { CenterState, ErrorState } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

type WrappedData = {
  season: { half: "autumn" | "spring"; year: number };
  crewName: string;
  name: string;
  crewGames: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  share: number;
  duo: { partner: string; wins: number; losses: number; winRate: number; bestStreak: number } | null;
  hour: { weekday: number; time: string; heat: number[][]; recordNight: number };
  type: { key: WrappedType; a: string; b: string };
  eloPeak: number;
  mamas: number;
  rank: number;
  topPartners: string[];
  topNights: { night: string; wins: number; losses: number }[];
  highlights: { gameId: string; src: string; reactions: number; playedAt: string }[];
};
type Resp = { ready: true; data: WrappedData } | { ready: false; games: number; need: number };

const INK = "#0E0E0F";
const GOLD = "#FFC23D";
const DURS = [7000, 6500, 8000, 7000, 7000, 8500, 9000];
const THEMES: [string, string][] = [
  [INK, "#FFFFFF"],
  [GOLD, INK],
  ["#C8261A", "#FFFFFF"],
  [INK, "#FFFFFF"],
  ["#F4F4F2", INK],
  ["#FF6B1A", INK],
  [INK, "#FFFFFF"],
];
const TYPE_LOOK: Record<WrappedType, { bg: string; fg: string; icon: string }> = {
  mama: { bg: "#FF6B1A", fg: INK, icon: "🎯" },
  muur: { bg: "#2747D6", fg: "#FFFFFF", icon: "🧱" },
  kamikaze: { bg: "#C8261A", fg: "#FFFFFF", icon: "💥" },
  laatbloeier: { bg: "#5B2BBF", fg: "#FFFFFF", icon: "🌙" },
  kameleon: { bg: "#FF7FB0", fg: INK, icon: "🦎" },
  trouw: { bg: GOLD, fg: INK, icon: "🤝" },
  marathon: { bg: "#1C1C1D", fg: "#FFFFFF", icon: "🏃" },
};
const HOURS = ["20u", "21u", "22u", "23u", "00u", "01u"];

export default function WrappedScreen() {
  const { crewId } = useLocalSearchParams<{ crewId?: string }>();
  const { t } = useT();
  const W = t.beta.wrapped;
  const { me } = useAuth();
  const crews = me?.crews ?? [];
  const crew = crews.find((c) => c.id === crewId) ?? (crews.length === 1 ? crews[0] : undefined);
  const q = useQuery<Resp>(crew && me?.beta.features.wrapped ? `/crews/${crew.id}/wrapped` : null);

  if (!me?.beta.features.wrapped) return <Redirect href={{ pathname: "/beta/[feature]", params: { feature: "wrapped" } }} />;
  if (!crew && crews.length > 1) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <Header />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          <Text style={styles.kicker}>{W.kicker}</Text>
          <Text style={styles.pickTitle}>{W.pickCrew}</Text>
          {crews.map((c) => (
            <Pressable key={c.id} onPress={() => router.setParams({ crewId: c.id })} style={styles.crewRow}>
              <View style={styles.crewTile}>
                <Text style={{ fontFamily: fonts.display, color: colors.gold, fontSize: 16 }}>{c.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { fontFamily: fonts.bodySemi }]}>{c.name}</Text>
                <Text style={styles.small}>{format(W.crewGames, { n: c.games })}</Text>
              </View>
              <Text style={[styles.kicker, { color: colors.gold }]}>{W.watch}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  if (!q.data.ready) {
    const r = q.data;
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.kicker}>{W.kicker}</Text>
          <Text style={[styles.pickTitle, { fontSize: 52, textAlign: "center" }]}>{W.notEnoughTitle}</Text>
          <Text style={[styles.body, { textAlign: "center", color: colors.soft }]}>{format(W.notEnoughBody, { n: r.need - r.games })}</Text>
          <View style={styles.bar}>
            <View style={{ width: `${Math.round((r.games / r.need) * 100)}%`, height: "100%", backgroundColor: colors.gold }} />
          </View>
          <Text style={[styles.pickTitle, { fontSize: 22 }]}>{`${r.games} / ${r.need}`}</Text>
        </View>
        <Pressable onPress={() => router.navigate("/log")} style={[styles.cta, { margin: 20 }]}>
          <Text style={styles.ctaText}>{t.nav.log}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  return <Player data={q.data.data} />;
}

function Player({ data: d }: { data: WrappedData }) {
  const { t } = useT();
  const W = t.beta.wrapped;
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const n = 7;
  const next = useCallback(() => setI((x) => Math.min(n - 1, x + 1)), []);
  const prev = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    if (!started || paused || i === n - 1) return;
    const id = setTimeout(next, DURS[i]);
    return () => clearTimeout(id);
  }, [i, paused, started, next]);

  const look = i === 5 ? [TYPE_LOOK[d.type.key].bg, TYPE_LOOK[d.type.key].fg] : THEMES[i];
  const [bg, fg] = look;
  const season = format(d.season.half === "autumn" ? W.seasonAutumn : W.seasonSpring, { year: d.season.year });
  const days = W.days.split("|");
  const type = W.types[d.type.key];
  const big = (s: object = {}) => [styles.big, { color: fg }, s];
  const txt = (s: object = {}) => [styles.body, { color: fg }, s];
  const kick = (s: object = {}) => [styles.kicker, { color: fg, opacity: 0.75 }, s];

  const shareCard = () =>
    void Share.share({
      message: [
        `${W.kicker} · ${season}`,
        `${d.name} — ${type.name}`,
        `${d.games} ${W.games} · ${d.wins}–${d.losses} · ${d.winRate}%`,
        d.duo ? `${W.duoYou} ${d.duo.partner}: ${d.duo.wins}–${d.duo.losses}` : null,
        `${W.eloPeak} ${d.eloPeak} · ${W.mamas} ${d.mamas}`,
        format(W.rankLine, { crew: d.crewName, rank: d.rank }),
      ]
        .filter(Boolean)
        .join("\n"),
    });

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.bars}>
          {Array.from({ length: n }, (_, k) => (
            <View key={k} style={[styles.seg, { backgroundColor: fg === INK ? "rgba(14,14,15,0.2)" : "rgba(255,255,255,0.25)" }]}>
              <View style={{ height: "100%", width: k < i ? "100%" : k === i && (started || i > 0) ? "100%" : "0%", backgroundColor: fg, opacity: k === i ? 0.9 : 1 }} />
            </View>
          ))}
        </View>
        <View style={styles.top}>
          <Text style={kick()}>{`${W.kicker} · ${season}`}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setPaused((p) => !p)} accessibilityLabel={paused ? W.play : W.pause} style={styles.icon} hitSlop={6}>
              <Text style={{ color: fg, fontSize: 14 }}>{paused ? "▶" : "❚❚"}</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} accessibilityLabel={W.close} style={styles.icon} hitSlop={6}>
              <Text style={{ color: fg, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Animated.View key={i} entering={FadeIn.duration(400)} style={styles.slide}>
            {i === 0 && (
              <>
                <Animated.Text entering={ZoomIn.springify().damping(9)} style={big({ fontSize: Math.min(110, width * 0.27) })}>
                  {W.introA}
                  {"\n"}
                  <Text style={{ color: GOLD }}>{W.introB}</Text>
                  {W.introC}
                </Animated.Text>
                <Text style={txt({ fontSize: 19, fontFamily: fonts.bodySemi })}>{format(W.introLine, { name: d.name })}</Text>
                <Text style={txt({ opacity: 0.7 })}>{format(W.introSub, { games: d.crewGames })}</Text>
                {!started && (
                  <Pressable onPress={() => setStarted(true)} style={[styles.cta, { backgroundColor: GOLD, marginTop: 20 }]}>
                    <Text style={styles.ctaText}>{W.start}</Text>
                  </Pressable>
                )}
              </>
            )}
            {i === 1 && (
              <>
                <Text style={txt({ fontSize: 20 })}>{W.gamesLead}</Text>
                <Animated.Text entering={ZoomIn.springify()} style={big({ fontSize: 160, lineHeight: 160 })}>
                  {d.games}
                </Animated.Text>
                <Text style={kick({ fontSize: 22 })}>{W.games}</Text>
                <Text style={txt()}>{format(W.gamesShare, { pct: d.share, total: d.crewGames, crew: d.crewName })}</Text>
                <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
                  {(
                    [
                      [d.wins, W.won],
                      [d.losses, W.lost],
                      [`${d.winRate}%`, W.winRate],
                    ] as const
                  ).map(([v, k]) => (
                    <Animated.View key={k} entering={FadeInDown.delay(400)}>
                      <Text style={big({ fontSize: 40 })}>{v}</Text>
                      <Text style={kick()}>{k}</Text>
                    </Animated.View>
                  ))}
                </View>
              </>
            )}
            {i === 2 && (
              <>
                <Text style={txt({ fontSize: 20 })}>{W.duoLead}</Text>
                {d.duo ? (
                  <>
                    <Animated.Text entering={ZoomIn.springify()} style={big({ fontSize: 64 })}>
                      {W.duoYou}
                      {"\n"}
                      {d.duo.partner}
                    </Animated.Text>
                    <View style={{ flexDirection: "row", gap: 24, marginTop: 12 }}>
                      <View>
                        <Text style={big({ fontSize: 44 })}>{`${d.duo.wins}–${d.duo.losses}`}</Text>
                        <Text style={kick()}>{W.duoRecord}</Text>
                      </View>
                      <View>
                        <Text style={big({ fontSize: 44 })}>{`${d.duo.winRate}%`}</Text>
                        <Text style={kick()}>{W.duoWin}</Text>
                      </View>
                    </View>
                    {d.duo.bestStreak >= 2 && <Text style={txt()}>{format(W.duoStreak, { n: d.duo.bestStreak })}</Text>}
                    <Text style={txt({ opacity: 0.7 })}>{format(W.duoFoot, { n: d.duo.wins + d.duo.losses })}</Text>
                  </>
                ) : (
                  <Text style={txt({ fontSize: 22 })}>{W.duoNone}</Text>
                )}
              </>
            )}
            {i === 3 && (
              <>
                <Text style={txt({ fontSize: 20 })}>{W.hourLead}</Text>
                <Animated.Text entering={ZoomIn.springify()} style={big({ fontSize: 72, color: GOLD })}>
                  {d.hour.time}
                </Animated.Text>
                <Text style={txt()}>{format(W.hourBody, { day: days[d.hour.weekday] ?? "" })}</Text>
                <View style={{ gap: 4, marginTop: 12 }}>
                  {d.hour.heat.map((row, wd) => (
                    <View key={wd} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <Text style={[styles.small, { width: 34, color: fg }]}>{W.daysShort.split("|")[wd]}</Text>
                      {row.map((v, h) => (
                        <View key={h} style={{ flex: 1, height: 18, borderRadius: 4, backgroundColor: GOLD, opacity: 0.08 + Math.min(1, v) * 0.92 }} />
                      ))}
                    </View>
                  ))}
                  <View style={{ flexDirection: "row", gap: 4, paddingLeft: 38 }}>
                    {HOURS.map((h) => (
                      <Text key={h} style={[styles.small, { flex: 1, textAlign: "center", color: fg }]}>
                        {h}
                      </Text>
                    ))}
                  </View>
                </View>
                <Text style={txt({ marginTop: 8 })}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 28 }}>{d.hour.recordNight}</Text>
                  {` ${W.recordNight}`}
                </Text>
              </>
            )}
            {i === 4 && (
              <>
                <Text style={txt({ fontSize: 20 })}>{W.highlightsLead}</Text>
                <Text style={big({ fontSize: 48 })}>{W.highlightsTitle}</Text>
                {d.highlights.length === 0 ? (
                  <Text style={txt()}>{W.highlightsNone}</Text>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    {d.highlights.map((h, k) => (
                      <Animated.View key={h.gameId} entering={ZoomIn.delay(k * 250)} style={{ flex: 1, gap: 4 }}>
                        <Image source={{ uri: apiUrl(h.src), headers: authHeaders() }} style={styles.photo} contentFit="cover" />
                        <Text style={[styles.small, { color: fg }]}>{format(W.reactions, { n: h.reactions })}</Text>
                      </Animated.View>
                    ))}
                  </View>
                )}
                <Text style={txt({ opacity: 0.7 })}>{W.highlightsBy}</Text>
              </>
            )}
            {i === 5 && (
              <>
                <Text style={txt({ fontSize: 20 })}>{W.typeLead}</Text>
                <Animated.Text entering={ZoomIn.springify().damping(8)} style={{ fontSize: 80 }}>
                  {TYPE_LOOK[d.type.key].icon}
                </Animated.Text>
                <Text style={big({ fontSize: 56 })}>{type.name}</Text>
                <Text style={txt({ fontSize: 17 })}>{type.body}</Text>
                <View style={{ flexDirection: "row", gap: 24, marginTop: 8 }}>
                  <View>
                    <Text style={big({ fontSize: 36 })}>{d.type.a}</Text>
                    <Text style={kick()}>{type.a}</Text>
                  </View>
                  <View>
                    <Text style={big({ fontSize: 36 })}>{d.type.b}</Text>
                    <Text style={kick()}>{type.b}</Text>
                  </View>
                </View>
                <Text style={txt({ opacity: 0.75, fontSize: 13 })}>{`${W.whyType} ${type.why}`}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {type.chips.split("|").map((c) => (
                    <Text key={c} style={[styles.chip, { color: fg, borderColor: fg }]}>
                      {c}
                    </Text>
                  ))}
                </View>
              </>
            )}
            {i === 6 && (
              <>
                <View style={styles.card}>
                  <Text style={[styles.kicker, { color: GOLD }]}>{`${W.kicker} · ${season}`}</Text>
                  <Text style={[styles.big, { fontSize: 48, color: "#fff" }]}>{d.name}</Text>
                  <Text style={[styles.body, { color: colors.soft }]}>{format(W.rankLine, { crew: d.crewName, rank: d.rank })}</Text>
                  <View style={[styles.typeBox, { backgroundColor: TYPE_LOOK[d.type.key].bg }]}>
                    <Text style={[styles.kicker, { color: TYPE_LOOK[d.type.key].fg }]}>{W.typeLabel}</Text>
                    <Text style={[styles.big, { fontSize: 28, color: TYPE_LOOK[d.type.key].fg }]}>{`${TYPE_LOOK[d.type.key].icon} ${type.name}`}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
                    {(
                      [
                        [d.games, W.games],
                        [`${d.winRate}%`, W.winRate],
                        [d.eloPeak, W.eloPeak],
                        [d.mamas, W.mamas],
                        [d.hour.time, W.shussHour],
                        [`${d.wins}–${d.losses}`, `${W.won}–${W.lost}`],
                      ] as const
                    ).map(([v, k]) => (
                      <View key={k} style={{ width: "33%" }}>
                        <Text style={[styles.big, { fontSize: 26, color: "#fff" }]}>{v}</Text>
                        <Text style={[styles.kicker, { fontSize: 10, color: colors.muted }]}>{k}</Text>
                      </View>
                    ))}
                  </View>
                  {d.topPartners.length > 0 && <Text style={[styles.small, { color: colors.soft }]}>{`${W.topPartners}: ${d.topPartners.join(", ")}`}</Text>}
                  {d.topNights.length > 0 && (
                    <Text style={[styles.small, { color: colors.soft }]}>{`${W.topNights}: ${d.topNights.map((x) => `${x.night} (${x.wins}–${x.losses})`).join(" · ")}`}</Text>
                  )}
                </View>
                <Pressable onPress={shareCard} style={[styles.cta, { backgroundColor: GOLD }]}>
                  <Text style={styles.ctaText}>{W.share}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setI(0);
                    setStarted(true);
                  }}
                  style={{ alignItems: "center", paddingVertical: 10 }}
                >
                  <Text style={[styles.kicker, { color: fg }]}>{W.again}</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
          {(started || i > 0) && i < n - 1 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={{ flex: 1, flexDirection: "row" }}>
                <Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel={W.prev} />
                <Pressable style={{ flex: 2 }} onPress={next} accessibilityLabel={W.next} />
              </View>
            </View>
          )}
          {i === n - 1 && (
            <Pressable style={{ position: "absolute", left: 0, top: 0, bottom: 200, width: "30%" }} onPress={prev} accessibilityLabel={W.prev} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  kicker: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 2, color: colors.muted, textTransform: "uppercase" },
  pickTitle: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44, color: colors.cream, textTransform: "uppercase" },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.cream },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.line },
  crewTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  bar: { width: 240, height: 10, borderRadius: 999, backgroundColor: colors.chip, overflow: "hidden", marginTop: 12 },
  cta: { height: 56, borderRadius: 999, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 16, color: INK },
  bars: { flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  seg: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(127,127,127,0.18)", alignItems: "center", justifyContent: "center" },
  slide: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 12 },
  big: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, textTransform: "uppercase" },
  photo: { width: "100%", aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.1)" },
  chip: { fontFamily: fonts.bodySemi, fontSize: 12, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  card: { gap: 12, padding: 20, borderRadius: 24, backgroundColor: "#1C1C1D", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  typeBox: { padding: 14, borderRadius: 16, gap: 4 },
});
