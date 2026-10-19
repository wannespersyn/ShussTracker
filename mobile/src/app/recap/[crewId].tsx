/**
 * Recap — Route: /recap/[crewId]
 *
 * The two recaps from the website: your month as six story slides (tap to
 * go forward, swipe-free like Instagram stories) and the crew's season so
 * far (games, biggest blowout, best partner, top scorer, most games, red
 * zone regular). The month opens first when you played lately.
 *
 * Data: GET /api/v1/crews/{crewId}/recap (text in the app language)
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import type { Recap, RecapStory } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { useQuery } from "@/lib/useQuery";
import { Card, CenterState, ErrorState, Kicker, Segmented, Txt } from "@/components/ui";
import { Header } from "@/components/Header";
import { colors, fonts } from "@/theme";

const TONES: Record<RecapStory["tone"], { bg: string; fg: string }> = {
  amber: { bg: "#ffb627", fg: "#111111" },
  ink: { bg: "#0b0d0c", fg: "#f3f1ea" },
  panel: { bg: "#15191a", fg: "#f3f1ea" },
  red: { bg: "#ff6b5b", fg: "#111111" },
};

function Story({ slides, crewName }: { slides: RecapStory[]; crewName: string }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const s = slides[i];
  const tone = TONES[s.tone];
  return (
    <SafeAreaView style={[styles.story, { backgroundColor: tone.bg }]} edges={["top", "bottom"]}>
      <View style={styles.progress}>
        {slides.map((_, k) => (
          <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: tone.fg, opacity: k <= i ? 1 : 0.25 }} />
        ))}
      </View>
      <View style={styles.storyHead}>
        <Text style={[styles.storyBrand, { color: tone.fg }]} numberOfLines={1}>{`SHUSSAPP · ${crewName.toUpperCase()}`}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t.monthly.close}>
          <Text style={{ color: tone.fg, fontSize: 22 }}>✕</Text>
        </Pressable>
      </View>
      <Pressable style={styles.storyBody} onPress={() => setI((k) => Math.min(slides.length - 1, k + 1))} accessibilityLabel={t.monthly.nextSlide}>
        <Text style={[styles.storyKicker, { color: tone.fg }]}>{s.kicker}</Text>
        <Text
          style={[styles.storyBig, { color: tone.fg, fontSize: Math.round(s.bigSize * 0.85), lineHeight: Math.round(s.bigSize * 0.85) }]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {s.big}
        </Text>
        <Text style={[styles.storyLine, { color: tone.fg }]}>{s.line}</Text>
        <Text style={[styles.storyFoot, { color: tone.fg }]}>{s.foot}</Text>
      </Pressable>
      <View style={styles.storyNav}>
        <Pressable onPress={() => setI((k) => Math.max(0, k - 1))} style={[styles.storyBtn, { borderColor: tone.fg, borderWidth: 2 }]}>
          <Text style={[styles.storyBtnText, { color: tone.fg }]}>{t.monthly.back}</Text>
        </Pressable>
        <Pressable
          onPress={() => (i === slides.length - 1 ? router.back() : setI((k) => k + 1))}
          style={[styles.storyBtn, { flex: 2, backgroundColor: tone.fg }]}
        >
          <Text style={[styles.storyBtnText, { color: tone.bg }]}>{i === slides.length - 1 ? t.common.close.toUpperCase() : t.monthly.next}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ title, who, big, sub, empty }: { title: string; who?: string; big?: string | number; sub?: string; empty?: string }) {
  return (
    <Card style={{ gap: 2 }}>
      <Kicker>{title}</Kicker>
      {big === undefined ? (
        <Txt style={{ color: colors.muted }}>{empty}</Txt>
      ) : (
        <>
          {who ? <Txt v="heading">{who}</Txt> : null}
          <Txt style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 50, color: colors.gold }}>{big}</Txt>
          {sub ? <Txt style={{ color: colors.soft }}>{sub}</Txt> : null}
        </>
      )}
    </Card>
  );
}

export default function RecapScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const { t, locale } = useT();
  const S = t.season;
  const q = useQuery<Recap>(`/crews/${crewId}/recap?lang=${locale}`);
  const [view, setView] = useState<"month" | "season" | null>(null);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!q.data) return <CenterState />;
  const { monthly, season, crewName } = q.data;
  const shown = view ?? (monthly ? "month" : "season");

  if (shown === "month" && monthly) {
    return (
      <View style={{ flex: 1 }}>
        <Story slides={monthly.slides} crewName={crewName} />
        <Pressable onPress={() => setView("season")} style={styles.toSeason}>
          <Text style={styles.toSeasonText}>{t.more.seasonRecap} ›</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title={t.more.seasonRecap} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
        {monthly && (
          <Segmented
            value={shown}
            onChange={setView}
            options={[
              { id: "month", label: monthly.month },
              { id: "season", label: season.label },
            ]}
          />
        )}
        <Kicker>{`${crewName} · ${season.label}`}</Kicker>
        <Stat
          title={S.showedUp}
          big={season.showedUp.games}
          sub={format(season.showedUp.nights === 1 ? S.acrossOne : S.across, { n: season.showedUp.nights })}
        />
        <Stat
          title={S.blowout}
          who={season.biggestWin?.winnerNames}
          big={season.biggestWin?.margin}
          sub={season.biggestWin ? format(S.margin, { names: season.biggestWin.loserNames }) : undefined}
          empty={S.noGames}
        />
        <Stat
          title={S.bestPartner}
          who={season.bestDuo?.names}
          big={season.bestDuo?.wins}
          sub={season.bestDuo ? format(S.winsTogether, { w: season.bestDuo.wins, l: season.bestDuo.losses }) : undefined}
          empty={S.noPartner}
        />
        <Stat
          title={S.topScorer}
          who={season.topScorer?.name}
          big={season.topScorer?.points}
          sub={season.topScorer ? S.pointsSeason : undefined}
          empty={S.noPoints}
        />
        <Stat
          title={S.mostGames}
          who={season.mostGames?.name}
          big={season.mostGames?.games}
          sub={season.mostGames ? S.gamesPlayed : undefined}
          empty={S.noGames}
        />
        <Stat title={S.redZone} who={season.redZones?.name} big={season.redZones?.count} sub={season.redZones ? S.chugs : undefined} empty={S.noRed} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  story: { flex: 1, paddingHorizontal: 22, gap: 10 },
  progress: { flexDirection: "row", gap: 4, paddingTop: 8 },
  storyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  storyBrand: { flex: 1, fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.5 },
  storyBody: { flex: 1, justifyContent: "center", gap: 14 },
  storyKicker: { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 2.8, opacity: 0.75 },
  storyBig: { fontFamily: fonts.display },
  storyLine: { fontFamily: fonts.headBold, fontSize: 30, lineHeight: 32 },
  storyFoot: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, opacity: 0.8 },
  storyNav: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  storyBtn: { flex: 1, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  storyBtnText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1.4 },
  toSeason: { position: "absolute", right: 22, bottom: 90, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.25)" },
  toSeasonText: { fontFamily: fonts.headBold, fontSize: 13, color: "#f3f1ea", letterSpacing: 0.8, textTransform: "uppercase" },
});
