"use client";

import { useTransition } from "react";
import { LOCALES } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { setLocaleAction } from "@/app/(app)/settings/preferences-actions";

/** EN / NL chips that set the locale cookie (works signed out too). */
export function LangSwitch({ size = "md" }: Readonly<{ size?: "sm" | "md" }>) {
  const { t, locale } = useT();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t.settings.language} className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() => {
            const fd = new FormData();
            fd.append("locale", l);
            start(() => setLocaleAction(fd));
          }}
          className={cn(
            "rounded-sm font-heading font-bold uppercase",
            size === "sm" ? "w-9 h-8 text-[13px]" : "w-11 h-9 text-[15px]",
            l === locale ? "bg-amber text-ink" : "bg-surface-panel border border-line text-muted",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
