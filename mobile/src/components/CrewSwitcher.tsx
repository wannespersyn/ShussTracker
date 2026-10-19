/**
 * CrewSwitcher
 *
 * Row of crew chips shown on Home and Crew when the user is in more than
 * one crew; tapping one switches the selected crew everywhere.
 */
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useCrew } from "@/lib/crew";
import { colors, fonts } from "@/theme";

export function CrewSwitcher() {
  const { crews, crew, setCrewId } = useCrew();
  if (crews.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {crews.map((c) => {
        const active = c.id === crew?.id;
        return (
          <Pressable key={c.id} onPress={() => setCrewId(c.id)} style={[styles.chip, active && styles.active]} accessibilityState={{ selected: active }}>
            <Text style={[styles.text, { color: active ? colors.ink : colors.soft }]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" },
  active: { backgroundColor: colors.gold, borderColor: colors.gold },
  text: { fontFamily: fonts.headBold, fontSize: 14, letterSpacing: 0.8, textTransform: "uppercase" },
});
