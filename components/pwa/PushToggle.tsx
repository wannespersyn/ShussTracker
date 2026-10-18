"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { subscribePushAction, unsubscribePushAction } from "@/app/(app)/settings/push-actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Per-device notification switch (Web Push through the service worker). */
export function PushToggle({
  publicKey,
  labels,
}: Readonly<{
  publicKey: string | null;
  labels: { title: string; on: string; off: string; denied: string; iosInstall: string; unsupported: string };
}>) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!publicKey || !("serviceWorker" in navigator)) return setState("unsupported");
      if (!("PushManager" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  function toggle() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await unsubscribePushAction(existing.endpoint);
        await existing.unsubscribe();
        setState("off");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await subscribePushAction(json);
      setState("on");
    });
  }

  const on = state === "on";
  const usable = state === "on" || state === "off";
  const sub =
    state === "on" ? labels.on : state === "off" || state === "loading" ? labels.off : state === "denied" ? labels.denied : state === "ios-install" ? labels.iosInstall : labels.unsupported;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!usable || pending}
      aria-pressed={on}
      className="w-full flex items-center gap-3 min-h-15 px-4 py-2 rounded-[14px] bg-surface-panel border border-cream/10 text-left text-cream disabled:cursor-default"
    >
      <span className="flex-1 flex flex-col">
        <span className="font-body font-semibold text-[15px]">{labels.title}</span>
        <span className="font-body font-medium text-xs text-muted">{sub}</span>
      </span>
      {usable && (
        <span className={cn("w-12 h-7 rounded-pill p-0.75 flex shrink-0", on ? "bg-amber justify-end" : "bg-chip justify-start", pending && "opacity-60")}>
          <span className={cn("w-5.5 h-5.5 rounded-pill", on ? "bg-ink" : "bg-muted")} />
        </span>
      )}
    </button>
  );
}
