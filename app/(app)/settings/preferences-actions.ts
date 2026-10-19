"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FLAIR_COOKIE, LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme } from "@/lib/i18n/config";
import { auth } from "@/lib/auth";
import { setPushLocale } from "@/lib/push";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Theme + language live in cookies (not the DB) so they apply before
 * sign-in too and need no migration. */
export async function setThemeAction(formData: FormData) {
  const value = String(formData.get("theme") ?? "");
  if (!isTheme(value)) return;
  (await cookies()).set(THEME_COOKIE, value, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setLocaleAction(formData: FormData) {
  const value = String(formData.get("locale") ?? "");
  if (!isLocale(value)) return;
  (await cookies()).set(LOCALE_COOKIE, value, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
  const userId = (await auth())?.user?.id;
  if (userId) await setPushLocale(userId, value).catch(() => {});
  revalidatePath("/", "layout");
}

export async function setFlairAction(formData: FormData) {
  const value = formData.get("flair") === "on" ? "on" : "off";
  (await cookies()).set(FLAIR_COOKIE, value, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
