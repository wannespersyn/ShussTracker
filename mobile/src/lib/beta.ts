/**
 * Beta helpers (app)
 *
 * The beta feature list from the website's lib/beta.ts plus the app-side
 * actions: join / leave, switch a feature, send feedback, and where each
 * feature can be tried in the app.
 *
 * Exports: BETA_FEATURES, BETA_TAGS, BETA_LEAVE_REASONS, BETA_ICON, useBetaActions, tryBeta
 * Data: PATCH /api/v1/me/beta, POST /api/v1/beta/feedback
 */
import { useCallback } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, apiUrl } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import type { BetaKey } from "@/api/types";

export { BETA_FEATURES, BETA_TAGS, BETA_LEAVE_REASONS } from "@shared/beta";

export const BETA_ICON: Record<BetaKey, string> = { wrapped: "🎁", start: "🎲", celebrations: "🎉", mat: "🎯", camera: "📹" };

export function useBetaActions() {
  const { refreshMe } = useAuth();
  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      await api("/me/beta", { method: "PATCH", body });
      await refreshMe().catch(() => {});
    },
    [refreshMe],
  );
  return {
    join: () => patch({ optIn: true }),
    leave: (reason?: string) => patch({ optIn: false, reason }),
    setFeature: (feature: BetaKey, on: boolean) => patch({ feature, on }),
    feedback: (body: { feature: string; rating?: number | null; tags?: string[]; text?: string }) => api("/beta/feedback", { method: "POST", body }),
  };
}

/** Opens the place in the app where a beta feature lives. The camera runs
 * in the browser (it needs the website's image processing). */
export function tryBeta(key: BetaKey) {
  if (key === "wrapped") router.push("/wrapped");
  else if (key === "camera") void WebBrowser.openBrowserAsync(apiUrl("/camera/live"));
  else router.push("/log");
}
