/**
 * App i18n
 *
 * Uses the website's dictionaries (../lib/i18n in the repo root) so web and
 * app share one set of EN/NL copy. Picks the device language on first run;
 * a choice in the Me tab is remembered. Also tells the API client which
 * language to send (errors, achievements and pushes follow it).
 *
 * Exports: I18nProvider, useT, format, LOCALES, Locale
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { en } from "@i18n/dictionaries/en";
import { nl } from "@i18n/dictionaries/nl";
import { setApiLocale } from "@/api/client";

export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];
export type Dictionary = typeof en;
const DICTS: Record<Locale, Dictionary> = { en, nl: nl as Dictionary };
const KEY = "shussapp.locale";

export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

function deviceLocale(): Locale {
  for (const l of getLocales()) if ((LOCALES as readonly string[]).includes(l.languageCode ?? "")) return l.languageCode as Locale;
  return "en";
}

type Ctx = { locale: Locale; t: Dictionary; setLocale: (l: Locale) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => {
      if (v === "en" || v === "nl") setLocaleState(v);
    });
  }, []);

  setApiLocale(locale);
  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: DICTS[locale],
      setLocale: (l) => {
        setLocaleState(l);
        setApiLocale(l);
        SecureStore.setItemAsync(KEY, l).catch(() => {});
      },
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT() must be used inside <I18nProvider>");
  return ctx;
}
