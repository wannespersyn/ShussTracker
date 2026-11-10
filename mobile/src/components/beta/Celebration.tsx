/**
 * Celebration (beta)
 *
 * The "viermomenten" after a win, like the website: game won (Elo), streak,
 * ranking climb and achievement unlocked — max three, winners only, once
 * per device per game. Each moment animates in, then the next one starts;
 * tap to skip ahead.
 *
 * Data: `moments` from GET /api/v1/games/{id} (celebrations beta).
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import type { CelebrationMoment } from "@/api/types";
import { format, useT } from "@/lib/i18n";
import { colors, fonts } from "@/theme";

const DUR: Record<CelebrationMoment["kind"], number> = { win: 4700, streak: 3900, climb: 4600, achievement: 4800 };
const seenKey = (gameId: string) => `shuss.celebrated.${gameId}`;

export function Celebration({ gameId, moments }: { gameId: string; moments: CelebrationMoment[] }) {
  const { t } = useT();
  const C = t.beta.celebrate;
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    if (moments.length === 0) return;
    let live = true;
    SecureStore.getItemAsync(seenKey(gameId))
      .catch(() => null)
      .then((seen) => {
        if (!live || seen) return;
        SecureStore.setItemAsync(seenKey(gameId), "1").catch(() => {});
        setI(0);
      });
    return () => {
      live = false;
    };
  }, [gameId, moments.length]);

  useEffect(() => {
    if (i === null) return;
    const id = setTimeout(() => setI((x) => (x === null || x + 1 >= moments.length ? null : x + 1)), DUR[moments[i].kind]);
    return () => clearTimeout(id);
  }, [i, moments]);

  if (i === null) return null;
  const m = moments[i];
  const next = () => setI((x) => (x === null || x + 1 >= moments.length ? null : x + 1));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setI(null)}>
      <Pressable style={styles.stage} onPress={next} accessibilityLabel={C.tap}>
        <Animated.View key={i} entering={ZoomIn.springify().damping(12)} style={styles.center}>
          {m.kind === "win" && (
            <>
              <Text style={styles.kicker}>{m.team}</Text>
              <Text style={[styles.big, { color: colors.gold }]}>{C.won}</Text>
              <Text style={styles.line}>{`${m.before} → ${m.after}`}</Text>
              <Text style={[styles.chip, { color: colors.mint }]}>{format(C.eloUp, { n: m.elo })}</Text>
            </>
          )}
          {m.kind === "streak" && (
            <>
              <Text style={{ fontSize: 64 }}>🔥</Text>
              <Text style={[styles.big, { color: colors.red }]}>{m.n}</Text>
              <Text style={styles.line}>{C.winsInRow}</Text>
              {m.record && <Text style={[styles.chip, { color: colors.gold }]}>{format(C.recordCrew, { crew: m.crew })}</Text>}
            </>
          )}
          {m.kind === "climb" && (
            <>
              <Text style={styles.kicker}>{format(C.crewRanking, { crew: m.crew })}</Text>
              <Text style={[styles.big, { color: colors.gold }]}>{C.climb}</Text>
              <Text style={styles.line}>{m.from - m.to === 1 ? C.placesOne : format(C.places, { n: m.from - m.to })}</Text>
              <View style={styles.rows}>
                {m.rows.map((r) => (
                  <View key={`${r.rank}-${r.name}`} style={[styles.row, r.me && { backgroundColor: colors.gold }]}>
                    <Text style={[styles.rowText, r.me && { color: colors.ink }]}>{`#${r.rank}`}</Text>
                    <Text style={[styles.rowText, { flex: 1 }, r.me && { color: colors.ink }]} numberOfLines={1}>
                      {r.me ? format(C.you, { name: r.name }) : r.name}
                    </Text>
                    <Text style={[styles.rowText, r.me && { color: colors.ink }]}>{r.elo}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {m.kind === "achievement" && (
            <>
              <Text style={styles.kicker}>{C.unlocked}</Text>
              <Text style={{ fontSize: 64 }}>🏅</Text>
              <Text style={[styles.big, { fontSize: 44 }]}>{m.name}</Text>
              <Text style={styles.line}>{m.desc}</Text>
              {m.rarity > 0 && <Text style={[styles.chip, { color: colors.gold }]}>{format(C.rarity, { n: m.rarity })}</Text>}
            </>
          )}
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(1200)} style={styles.tap}>
          {C.tap}
        </Animated.Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#0E0E0F", alignItems: "center", justifyContent: "center", padding: 28 },
  center: { alignItems: "center", gap: 10, width: "100%" },
  kicker: { fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 2.2, color: colors.muted, textTransform: "uppercase", textAlign: "center" },
  big: { fontFamily: fonts.display, fontSize: 88, lineHeight: 92, color: colors.cream, textTransform: "uppercase", textAlign: "center" },
  line: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.soft, textAlign: "center" },
  chip: { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 6 },
  rows: { width: "100%", gap: 4, marginTop: 12 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.deep },
  rowText: { fontFamily: fonts.headBold, fontSize: 16, color: colors.cream },
  tap: { position: "absolute", bottom: 48, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.dim },
});
