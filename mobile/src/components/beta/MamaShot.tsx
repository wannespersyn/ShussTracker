/**
 * MamaShot (beta celebrations)
 *
 * The short full-screen "MAMA!" flash when a throw lands in a mama: red
 * flicker, the thrower's name and team colour, gone after ~1.6 s (or tap).
 */
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";
import { colors, fonts } from "@/theme";

const TEAM = ["#EFE7D3", "#5FB7FF"];

export function MamaShot({ name, team, onDone }: { name: string; team: number; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1600);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Pressable style={styles.stage} onPress={onDone}>
        <Animated.View entering={ZoomIn.springify().damping(9)} exiting={FadeOut} style={{ alignItems: "center", gap: 8 }}>
          <Text style={styles.big}>MAMA!</Text>
          <Text style={[styles.name, { color: TEAM[team] ?? colors.cream }]}>{name}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "rgba(227,16,30,0.92)", alignItems: "center", justifyContent: "center" },
  big: { fontFamily: fonts.display, fontSize: 110, lineHeight: 112, color: "#fff" },
  name: { fontFamily: fonts.display, fontSize: 34, textTransform: "uppercase" },
});
