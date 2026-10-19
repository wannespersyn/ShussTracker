/**
 * Me tab — Route: /me
 *
 * Who is signed in, the app language (EN / NL, also used for errors and
 * push notifications) and sign out. Profile stats, settings and account
 * deletion follow in a next step.
 */
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { LOCALES, useT, type Locale } from "@/lib/i18n";
import { Avatar, Button, Card, Kicker, Segmented, Txt } from "@/components/ui";
import { colors } from "@/theme";

const LABEL: Record<Locale, string> = { en: "English", nl: "Nederlands" };

export default function MeTab() {
  const { t, locale, setLocale } = useT();
  const { me, signOut } = useAuth();
  const name = me?.user.name ?? t.more.player;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Avatar name={name} size={64} />
          <View style={{ flex: 1 }}>
            <Txt v="display" numberOfLines={1}>{name}</Txt>
            {me?.user.email && <Txt style={{ color: colors.muted }} numberOfLines={1}>{me.user.email}</Txt>}
          </View>
        </View>

        <Card style={{ gap: 10 }}>
          <Kicker>{t.app.language}</Kicker>
          <Segmented value={locale} onChange={setLocale} options={LOCALES.map((l) => ({ id: l, label: LABEL[l] }))} />
        </Card>

        <View style={{ marginTop: 12 }}>
          <Button label={t.app.signOut} kind="outline" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 },
});
