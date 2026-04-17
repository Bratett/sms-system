import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = (await requestLocale) as string | undefined;
  // Defensive: fall back to default if the cookie was set to a locale the
  // app no longer ships (previous versions shipped only en/fr).
  const locale: Locale = (locales as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
