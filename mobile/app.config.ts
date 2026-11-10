/**
 * Expo app config
 *
 * Reads app.json and, with APP_VARIANT=development, turns it into a dev
 * build that installs next to the real app: its own name and bundle id
 * (app.shussapp.dev) and no Sign in with Apple or push entitlements (a free
 * Apple ID / Personal Team can't sign those), so it can be tested on your
 * own iPhone with the dev login. Production builds use app.json unchanged.
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

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.APP_VARIANT !== "development") return config as ExpoConfig;
  return withoutPaidCapabilities({
    ...config,
    name: "Shussapp (dev)",
    slug: config.slug ?? "shussapp",
    ios: { ...config.ios, bundleIdentifier: "app.shussapp.dev", usesAppleSignIn: false },
    android: { ...config.android, package: "app.shussapp.dev" },
    plugins: (config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-apple-authentication"),
  } as ExpoConfig);
};
