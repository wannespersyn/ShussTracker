/**
 * Google sign-in (native)
 *
 * Wraps @react-native-google-signin/google-signin: returns the Google ID
 * token the backend verifies (POST /api/v1/auth/google). Configured from
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; the
 * web client id makes Android return an ID token. Without them the button
 * stays hidden.
 *
 * Exports: googleConfigured, googleIdToken
 * Notes: the native module only exists in a development/store build, so it is
 *        loaded lazily — Expo Go and tests never touch it.
 */
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleConfigured = Boolean(IOS_CLIENT_ID || WEB_CLIENT_ID);

let configured = false;

/** Opens the Google account picker; resolves with an ID token, or null when the user cancels. */
export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = await import("@react-native-google-signin/google-signin");
  if (!configured) {
    GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID, webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type === "cancelled") return null;
    if (!res.data.idToken) throw new Error("Google returned no ID token");
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return null;
    throw e;
  }
}

/** Forget the Google account on this device (so the picker shows next time). */
export async function googleSignOut(): Promise<void> {
  if (!googleConfigured || !configured) return;
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
  await GoogleSignin.signOut().catch(() => null);
}
