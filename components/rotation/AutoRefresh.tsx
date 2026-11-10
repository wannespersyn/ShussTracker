/**
 * AutoRefresh
 *
 * Re-fetches the current server page every few seconds (and when the tab
 * becomes visible again), so a TV left on the Americano screen follows the
 * night without anyone touching it.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ seconds = 15 }: Readonly<{ seconds?: number }>) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}
