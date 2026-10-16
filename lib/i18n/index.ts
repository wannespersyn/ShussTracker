import { en } from "./dictionaries/en";
import { nl } from "./dictionaries/nl";
import type { Locale } from "./config";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Shape every language must match — derived from the English dictionary. */
export type Dictionary = Widen<typeof en>;

const dictionaries: Record<Locale, Dictionary> = { en, nl };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** `{name}`-style interpolation for the few strings that need it. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
