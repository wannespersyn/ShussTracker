"use client";

import { createContext, useContext } from "react";
import type { Dictionary } from "./index";
import type { Locale } from "./config";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: Readonly<{ locale: Locale; dictionary: Dictionary; children: React.ReactNode }>) {
  return <I18nContext.Provider value={{ locale, t: dictionary }}>{children}</I18nContext.Provider>;
}

/** Client-side access to the active dictionary: `const { t } = useT()`. */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT() must be used inside <I18nProvider>");
  return ctx;
}
