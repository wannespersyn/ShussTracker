/**
 * Expo app config
 *
 * Reads app.json and adds:
 * - Google sign-in: the native plugin with the reversed iOS client id, as
 *   soon as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set (see src/auth/google.ts).
 * - APP_VARIANT=development: a dev build that installs next to the real app,
 *   with its own name and bundle id (app.shussapp.dev) and no Sign in with
 *   Apple or push entitlements (a free Apple ID / Personal Team can't sign
 *   those), so it can be tested on your own iPhone with the dev login.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";
import { withEntitlementsPlist, type ConfigPlugin } from "expo/config-plugins";

/** Strips the capabilities a Personal Team can't sign, after every other plugin. */
const withoutPaidCapabilities: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults["com.apple.developer.applesignin"];
    delete c.modResults["aps-environment"];
    return c;
  });

/** "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc". */
const reversedClientId = (id: string) => `com.googleusercontent.apps.${id.replace(/\.apps\.googleusercontent\.com$/, "")}`;

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const withGoogle: ExpoConfig = {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ...(iosClientId ? [["@react-native-google-signin/google-signin", { iosUrlScheme: reversedClientId(iosClientId) }] as [string, unknown]] : []),
    ],
  };
  if (process.env.APP_VARIANT !== "development") return withGoogle;
  return withoutPaidCapabilities({
    ...withGoogle,
    name: "Shussapp (dev)",
    slug: withGoogle.slug ?? "shussapp",
    ios: { ...withGoogle.ios, bundleIdentifier: "app.shussapp.dev", usesAppleSignIn: false },
    android: { ...withGoogle.android, package: "app.shussapp.dev" },
    plugins: (withGoogle.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-apple-authentication"),
  } as ExpoConfig);
};
