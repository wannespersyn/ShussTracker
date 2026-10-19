/**
 * NoCrew
 *
 * Full-screen crew setup for users who aren't in a crew yet; Home, Log and
 * Crew show this instead of an empty state.
 */
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CrewSetup } from "@/components/crew/CrewSetup";
import { colors } from "@/theme";

export function NoCrew() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <CrewSetup />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
