/**
 * Crew setup screen — Route: /crews/new
 *
 * Join or start another crew (components/crew/CrewSetup.tsx), opened from
 * the Me tab. Closes and returns once the crew is joined or created.
 */
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useT } from "@/lib/i18n";
import { Txt } from "@/components/ui";
import { CrewSetup } from "@/components/crew/CrewSetup";
import { colors } from "@/theme";

export default function NewCrewScreen() {
  const { t } = useT();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.common.close} style={styles.round}>
          <Txt style={{ fontSize: 18 }}>✕</Txt>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <CrewSetup onDone={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { height: 52, paddingHorizontal: 16, justifyContent: "center" },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40 },
});
