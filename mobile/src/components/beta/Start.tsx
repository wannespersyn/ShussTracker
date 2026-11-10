/**
 * Beta start screens
 *
 * The full-screen "new game" moments from the website's beta, for the app:
 *  - FingerPicker: Chwazi — everyone puts a finger down, one gets picked;
 *  - TeamFingers: everyone holds their name, Chwazi pairs the duos;
 *  - CapToss: Shuss or Leber decides which team starts;
 *  - Countdown: 3-2-1-SHUSS before the game;
 *  - TeamDraw: the drawn teams, with "draw again".
 *
 * Exports: FingerPicker, TeamFingers, CapToss, Countdown, TeamDraw
 */
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { format, useT } from "@/lib/i18n";
import { colors, fonts } from "@/theme";

const COLORS = ["#FF6B1A", "#4A6BFF", "#FF7FB0", "#C6F04A", "#FFFFFF", "#7BE08A", "#B48CFF", "#4FD1FF"];
const HOLD_MS = 1500;
const BEAT_MS = 1600;
const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

function Stage({ children, onClose, closeLabel }: { children: React.ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait"]}>
      <View style={styles.stage}>
        {children}
        <Pressable onPress={onClose} accessibilityLabel={closeLabel} style={styles.close} hitSlop={8}>
          <Text style={{ color: colors.cream, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

type Finger = { id: string; x: number; y: number; c: string };

export function FingerPicker({ onClose, onDone, doneLabel }: { onClose: () => void; onDone: () => void; doneLabel: string }) {
  const { t } = useT();
  const S = t.beta.start;
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [phase, setPhase] = useState<"wait" | "beat" | "chosen">("wait");
  const [winner, setWinner] = useState<string | null>(null);
  const colorOf = useRef(new Map<string, string>());
  const next = useRef(0);
  const live = useRef<Finger[]>([]);
  live.current = fingers;
  const key = fingers.map((f) => f.id).join(",");

  useEffect(() => {
    if (phase !== "wait" || fingers.length < 2) return;
    const id = setTimeout(() => setPhase("beat"), HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, key, fingers.length]);
  useEffect(() => {
    if (phase !== "beat") return;
    const id = setTimeout(() => {
      const fs = live.current;
      setWinner(fs[Math.floor(Math.random() * fs.length)]?.id ?? null);
      setPhase("chosen");
      buzz();
    }, BEAT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  function sync(e: GestureResponderEvent) {
    if (phase === "chosen") return;
    const touches = e.nativeEvent.touches.map((tch) => {
      const id = String(tch.identifier);
      if (!colorOf.current.has(id)) colorOf.current.set(id, COLORS[next.current++ % COLORS.length]);
      return { id, x: tch.pageX, y: tch.pageY, c: colorOf.current.get(id)! };
    });
    if (touches.length !== live.current.length && phase === "beat") setPhase("wait");
    setFingers(touches);
  }

  const won = fingers.find((f) => f.id === winner);
  return (
    <Stage onClose={onClose} closeLabel={S.close}>
      <View
        style={[StyleSheet.absoluteFill, won && { backgroundColor: won.c }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={sync}
        onResponderMove={sync}
        onResponderRelease={sync}
        onResponderTerminationRequest={() => false}
      >
        {fingers.map((f) => (
          <Animated.View
            key={f.id}
            entering={ZoomIn}
            style={[styles.ring, { left: f.x - 48, top: f.y - 48, borderColor: f.c }, phase === "chosen" && f.id !== winner && { opacity: 0.15 }]}
          />
        ))}
      </View>
      <View pointerEvents="box-none" style={styles.overlayTop}>
        <Text style={[styles.kicker, won && { color: colors.ink }]}>{phase === "chosen" ? S.chosen : phase === "beat" ? S.choosing : S.fingers}</Text>
        {phase === "wait" && fingers.length < 2 && <Text style={styles.hint}>{S.fingersHint}</Text>}
      </View>
      {phase === "chosen" && (
        <View style={styles.bottom}>
          <Pressable onPress={onDone} style={[styles.cta, { backgroundColor: colors.ink }]}>
            <Text style={[styles.ctaText, { color: colors.cream }]}>{doneLabel}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setFingers([]);
              setWinner(null);
              setPhase("wait");
            }}
            style={styles.ghost}
          >
            <Text style={[styles.ghostText, { color: colors.ink }]}>{S.redo}</Text>
          </Pressable>
        </View>
      )}
    </Stage>
  );
}

/** Everyone holds a finger on their own name; once all hold still, Chwazi
 * pairs them into duos (consecutive pairs of a random order). */
export function TeamFingers({
  players,
  onClose,
  onDone,
  doneLabel,
}: {
  players: { id: string; name: string }[];
  onClose: () => void;
  onDone: (orderedIds: string[]) => void;
  doneLabel: string;
}) {
  const { t } = useT();
  const S = t.beta.start;
  const [held, setHeld] = useState<string[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const all = held.length === players.length;

  useEffect(() => {
    if (!all || order) return;
    const id = setTimeout(() => {
      const ids = players.map((p) => p.id).sort(() => Math.random() - 0.5);
      setOrder(ids);
      buzz();
    }, HOLD_MS + BEAT_MS / 2);
    return () => clearTimeout(id);
  }, [all, order, players]);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  return (
    <Stage onClose={onClose} closeLabel={S.close}>
      <View style={styles.overlayTop}>
        <Text style={styles.kicker}>{order ? S.chosen : all ? S.holdStill : S.fingerOnName}</Text>
        {!order && <Text style={styles.hint}>{S.fingerOnNameHint}</Text>}
      </View>
      {order ? (
        <Animated.View entering={FadeIn} style={{ width: "100%", gap: 12, paddingHorizontal: 24 }}>
          {Array.from({ length: order.length / 2 }, (_, i) => (
            <View key={i} style={[styles.team, { borderColor: COLORS[i % COLORS.length] }]}>
              <Text style={styles.teamLabel}>{i === 0 ? S.teamA : i === 1 ? S.teamB : `TEAM ${String.fromCharCode(65 + i)}`}</Text>
              <Text style={styles.teamNames}>{`${nameOf(order[i * 2])} & ${nameOf(order[i * 2 + 1])}`}</Text>
            </View>
          ))}
          <Pressable onPress={() => onDone(order)} style={styles.cta}>
            <Text style={styles.ctaText}>{doneLabel}</Text>
          </Pressable>
          <Pressable onPress={() => setOrder(null)} style={styles.ghost}>
            <Text style={styles.ghostText}>{S.redraw}</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.names}>
          {players.map((p, i) => {
            const on = held.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPressIn={() => setHeld((h) => (h.includes(p.id) ? h : [...h, p.id]))}
                onPressOut={() => setHeld((h) => h.filter((x) => x !== p.id))}
                style={[styles.name, on && { backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] }]}
              >
                <Text numberOfLines={1} style={[styles.nameText, on && { color: colors.ink }]}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Stage>
  );
}

/** Shuss (team A) or Leber (team B): tap the cap to toss. */
export function CapToss({ teamA, teamB, onClose, onDone }: { teamA: string; teamB: string; onClose: () => void; onDone: (side: "A" | "B") => void }) {
  const { t } = useT();
  const S = t.beta.start;
  const [side, setSide] = useState<"A" | "B" | null>(null);
  const [spin, setSpin] = useState(0);
  const toss = () => {
    setSide(null);
    setSpin((n) => n + 1);
    setTimeout(() => {
      setSide(Math.random() < 0.5 ? "A" : "B");
      buzz();
    }, 900);
  };
  return (
    <Stage onClose={onClose} closeLabel={S.close}>
      <View style={styles.overlayTop}>
        <Text style={styles.kicker}>{S.capToss}</Text>
        <Text style={styles.hint}>{`${format(S.sideA, { team: teamA })}  ·  ${format(S.sideB, { team: teamB })}`}</Text>
      </View>
      <Pressable onPress={toss} accessibilityLabel={S.tapToToss}>
        <Animated.View key={spin} entering={spin ? ZoomIn.springify().damping(6) : undefined} style={[styles.cap, side === "B" && { backgroundColor: "#5FB7FF" }]}>
          <Text style={styles.capText}>{side === "A" ? S.shuss : side === "B" ? S.leber : "?"}</Text>
        </Animated.View>
      </Pressable>
      {side ? (
        <View style={styles.bottom}>
          <Text style={[styles.teamNames, { textAlign: "center" }]}>{format(S.begins, { team: side === "A" ? teamA : teamB })}</Text>
          <Pressable onPress={() => onDone(side)} style={styles.cta}>
            <Text style={styles.ctaText}>{S.startGame}</Text>
          </Pressable>
          <Pressable onPress={toss} style={styles.ghost}>
            <Text style={styles.ghostText}>{S.again}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bottom}>
          <Text style={styles.hint}>{S.tapToToss}</Text>
        </View>
      )}
    </Stage>
  );
}

export function Countdown({ label, onDone }: { label: string; onDone: () => void }) {
  const { t } = useT();
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n < 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setN((x) => x - 1), n === 0 ? 900 : 800);
    if (n === 0) buzz();
    return () => clearTimeout(id);
  }, [n, onDone]);
  return (
    <Stage onClose={onDone} closeLabel={t.beta.start.close}>
      <Text style={styles.hint}>{label}</Text>
      <Animated.Text key={n} entering={ZoomIn.springify().damping(8)} style={[styles.count, n === 0 && { color: colors.gold, fontSize: 110 }]}>
        {n > 0 ? String(n) : t.beta.start.go}
      </Animated.Text>
    </Stage>
  );
}

export function TeamDraw({
  teamA,
  teamB,
  sub,
  onAgain,
  onClose,
  onDone,
  doneLabel,
}: {
  teamA: string[];
  teamB: string[];
  sub: string;
  onAgain: () => void;
  onClose: () => void;
  onDone: () => void;
  doneLabel: string;
}) {
  const { t } = useT();
  const S = t.beta.start;
  return (
    <Stage onClose={onClose} closeLabel={S.close}>
      <View style={styles.overlayTop}>
        <Text style={styles.kicker}>{S.teamsAre}</Text>
        <Text style={styles.hint}>{sub}</Text>
      </View>
      <View style={{ width: "100%", gap: 14, paddingHorizontal: 24 }}>
        {[teamA, teamB].map((names, i) => (
          <Animated.View key={`${i}-${names.join()}`} entering={ZoomIn.delay(i * 350).springify()} style={[styles.team, { borderColor: i === 0 ? "#EFE7D3" : "#5FB7FF" }]}>
            <Text style={styles.teamLabel}>{i === 0 ? S.teamA : S.teamB}</Text>
            <Text style={styles.teamNames}>{names.join(" & ")}</Text>
          </Animated.View>
        ))}
        {[teamA, teamB].length === 2 && <Text style={[styles.count, { fontSize: 28, textAlign: "center" }]}>VS</Text>}
      </View>
      <View style={styles.bottom}>
        <Pressable onPress={onDone} style={styles.cta}>
          <Text style={styles.ctaText}>{doneLabel}</Text>
        </Pressable>
        <Pressable onPress={onAgain} style={styles.ghost}>
          <Text style={styles.ghostText}>{S.redraw}</Text>
        </Pressable>
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#0E0E0F", alignItems: "center", justifyContent: "center", gap: 24 },
  close: { position: "absolute", top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  overlayTop: { position: "absolute", top: 110, left: 24, right: 24, alignItems: "center", gap: 8 },
  kicker: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 2.4, color: colors.cream, textAlign: "center" },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: "center" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 8 },
  bottom: { position: "absolute", bottom: 48, left: 24, right: 24, gap: 10, alignItems: "stretch" },
  cta: { height: 56, borderRadius: 999, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.headBold, fontSize: 19, letterSpacing: 1.2, color: colors.ink, textTransform: "uppercase" },
  ghost: { height: 44, alignItems: "center", justifyContent: "center" },
  ghostText: { fontFamily: fonts.headBold, fontSize: 15, letterSpacing: 1, color: colors.soft, textTransform: "uppercase" },
  names: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", paddingHorizontal: 20 },
  name: { minWidth: 130, height: 84, borderRadius: 20, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.deep, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  nameText: { fontFamily: fonts.headBold, fontSize: 19, color: colors.cream, textTransform: "uppercase" },
  team: { borderWidth: 3, borderRadius: 20, padding: 16, gap: 4, backgroundColor: colors.deep },
  teamLabel: { fontFamily: fonts.headBold, fontSize: 12, letterSpacing: 2, color: colors.muted },
  teamNames: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, textTransform: "uppercase" },
  cap: { width: 200, height: 200, borderRadius: 100, backgroundColor: colors.gold, borderWidth: 10, borderColor: "#c98a14", alignItems: "center", justifyContent: "center" },
  capText: { fontFamily: fonts.display, fontSize: 44, color: colors.ink },
  count: { fontFamily: fonts.display, fontSize: 160, color: colors.cream },
});
