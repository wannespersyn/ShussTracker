/**
 * CrewKickstart
 *
 * Same checklist as the website on a new crew's board, until it has played
 * 3 games: pick your game (owner), get at least 4 players in, log the first
 * game, play 3 games for a real ranking.
 *
 * Notes: the invite step shares the code when the viewer is the owner.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { format, useT } from "@/lib/i18n";
import { colors, fonts } from "@/theme";

export const KICKSTART_GAMES = 3;

type Step = { done: boolean; title: string; sub: string; cta?: string; onPress?: () => void };

export function CrewKickstart({
  crewId,
  isOwner,
  rulesSet,
  players,
  games,
  onInvite,
}: {
  crewId: string;
  isOwner: boolean;
  rulesSet: boolean;
  players: number;
  games: number;
  onInvite?: () => void;
}) {
  const { t } = useT();
  const K = t.kickstart;
  const steps: Step[] = [
    ...(isOwner ? [{ done: rulesSet, title: K.rules, sub: K.rulesSub, cta: K.rulesCta, onPress: () => router.push({ pathname: "/crews/[id]/manage", params: { id: crewId } }) }] : []),
    { done: players >= 4, title: K.invite, sub: format(K.inviteSub, { n: players }), cta: onInvite ? K.inviteCta : undefined, onPress: onInvite },
    { done: games >= 1, title: K.first, sub: K.firstSub, cta: K.firstCta, onPress: () => router.navigate({ pathname: "/log" }) },
    { done: games >= KICKSTART_GAMES, title: K.three, sub: format(K.threeSub, { n: games, total: KICKSTART_GAMES }) },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{K.title}</Text>
      {steps.map((s, i) => (
        <View key={s.title} style={[styles.row, s.done && { opacity: 0.55 }]}>
          <View style={[styles.dot, { backgroundColor: s.done ? colors.mint : i === next ? colors.gold : colors.chip }]}>
            <Text style={[styles.dotText, { color: s.done || i === next ? colors.ink : colors.muted }]}>{s.done ? "✓" : String(i + 1)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.stepTitle, s.done && { textDecorationLine: "line-through" }]}>{s.title}</Text>
            <Text style={styles.sub}>{s.sub}</Text>
          </View>
          {!s.done && s.cta && s.onPress && (
            <Pressable onPress={s.onPress} style={[styles.cta, i === next ? { backgroundColor: colors.gold } : { borderWidth: 1, borderColor: colors.lineStrong }]}>
              <Text style={[styles.ctaText, { color: i === next ? colors.ink : colors.cream }]}>{s.cta}</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.raised, borderWidth: 1, borderColor: "rgba(255,182,39,0.35)" },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.cream, textTransform: "uppercase", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dotText: { fontFamily: fonts.headBold, fontSize: 13 },
  stepTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.cream },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  cta: { height: 32, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
