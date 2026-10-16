import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, DEFAULT_THEME, FLAIR_COOKIE, LOCALE_COOKIE, LOCALES, THEME_COOKIE, isLocale, isTheme, type Locale, type Theme } from "./config";
import { getDictionary } from "./index";

/** Cookie first; otherwise the first supported language in Accept-Language. */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(code)) return code as Locale;
  }
  return DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}

export async function getT() {
  return getDictionary(await getLocale());
}

/** Streak flair (the app "heats up" on a win streak) — on unless turned off. */
export async function getFlair(): Promise<boolean> {
  return (await cookies()).get(FLAIR_COOKIE)?.value !== "off";
}
