export const locales = ["en", "fr", "tw"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Fran\u00e7ais",
  tw: "Twi",
};
