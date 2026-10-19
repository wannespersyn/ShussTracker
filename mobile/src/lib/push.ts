/**
 * Push notifications (app side)
 *
 * Asks permission, gets this device's Expo push token and registers it with
 * the backend (POST /api/v1/me/push-token) — the request language is stored
 * with it, so pushes arrive in the app's language. Tapping a notification
 * opens its game. The token is kept so sign-out can unregister the device.
 *
 * Exports: usePushNotifications, storedPushToken
 * Notes: remote push needs a development / store build with an EAS project
 * id — in Expo Go or without a project id, registration is silently skipped.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { api } from "@/api/client";

const KEY = "shussapp.pushToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const storedPushToken = () => SecureStore.getItemAsync(KEY).catch(() => null);

async function register(): Promise<void> {
  if (!Device.isDevice) return;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Shussapp", importance: AndroidImportance.HIGH, lightColor: "#ffb627" });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api("/me/push-token", { method: "POST", body: { token, platform: Platform.OS === "ios" ? "ios" : "android" } });
  await SecureStore.setItemAsync(KEY, token);
}

/** Pushes link to website paths ("/game/{id}"); open the matching screen. */
function open(url: unknown) {
  if (typeof url !== "string") return;
  const game = /^\/game\/([\w-]+)/.exec(url);
  if (game) router.push({ pathname: "/game/[id]", params: { id: game[1] } });
}

/** Registers this device while signed in (again when the language changes)
 * and routes notification taps. Mount once inside the signed-in area. */
export function usePushNotifications(signedIn: boolean, locale: string) {
  useEffect(() => {
    if (signedIn) register().catch(() => {});
  }, [signedIn, locale]);

  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification.request.content.data?.url);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.url));
    return () => sub.remove();
  }, []);
}
