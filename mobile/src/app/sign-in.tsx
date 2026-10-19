/**
 * Sign-in screen — Route: /sign-in (signed-out users only)
 *
 * Sign in with Apple (iOS), Google (placeholder until the development
 * build), and in development a "dev login" by email against a local
 * backend running with DEV_APP_LOGIN=1.
 */
import { useEffect, useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/api/client";
import { Button, Txt } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

export default function SignIn() {
  const { t } = useT();
  const { signInWithApple, signInDev } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
      setError(e instanceof ApiError && e.status === 0 ? t.app.offline : t.app.signInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function apple() {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error("no identity token");
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ") || null;
    await signInWithApple(credential.identityToken, name);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Txt style={styles.brand}>SHUSSAPP</Txt>
        <Txt v="display" style={styles.title}>
          {t.onboarding.headline}
        </Txt>
        <Txt style={styles.sub}>{t.app.signInSub}</Txt>
      </View>

      <View style={styles.actions}>
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.lg}
            style={styles.appleButton}
            onPress={() => run(apple)}
          />
        )}
        <Button label={t.app.google} kind="outline" disabled onPress={() => {}} />
        <Txt style={styles.note}>{t.app.googleSoon}</Txt>

        {__DEV__ && (
          <View style={styles.dev}>
            <Txt v="label">{t.app.devLogin}</Txt>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t.app.devEmail}
              placeholderTextColor={colors.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
            <Button label={t.app.devLogin} kind="primary" loading={busy} disabled={!email.trim()} onPress={() => run(() => signInDev(email.trim()))} />
          </View>
        )}

        {error && <Txt style={styles.error}>{error}</Txt>}
        <Txt style={styles.legal}>{t.onboarding.legal}</Txt>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24 },
  hero: { flex: 1, justifyContent: "center", gap: 14 },
  brand: { fontFamily: fonts.headBold, fontSize: 18, letterSpacing: 2.4, color: colors.gold },
  title: { fontSize: 64, lineHeight: 62, textTransform: "uppercase" },
  sub: { color: colors.soft, fontSize: 16, lineHeight: 22, maxWidth: 320 },
  actions: { gap: 10, paddingBottom: 16 },
  appleButton: { height: 54 },
  note: { color: colors.muted, fontSize: 12, textAlign: "center" },
  dev: { gap: 8, marginTop: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong },
  input: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.cream,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  error: { color: colors.redPale, textAlign: "center" },
  legal: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 6 },
});
