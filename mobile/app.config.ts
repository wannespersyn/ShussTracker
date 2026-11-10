/**
 * Expo app config
 *
 * Reads app.json and, with APP_VARIANT=development, turns it into a dev
 * build that installs next to the real app: its own name and bundle id
 * (app.shussapp.dev) and no Sign in with Apple, so it can be signed with a
 * free Apple ID (Personal Team) and tested on your own iPhone with the dev
 * login. Production builds use app.json unchanged.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.APP_VARIANT !== "development") return config as ExpoConfig;
  return {
    ...config,
    name: "Shussapp (dev)",
    slug: config.slug ?? "shussapp",
    ios: { ...config.ios, bundleIdentifier: "app.shussapp.dev", usesAppleSignIn: false },
    android: { ...config.android, package: "app.shussapp.dev" },
    plugins: (config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-apple-authentication"),
  };
};
