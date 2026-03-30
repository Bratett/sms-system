"use client";

import { useLocale } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;

  function handleChange(locale: string) {
    // Set cookie and reload to apply new locale
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  return (
    <div className="relative inline-flex items-center">
      <Globe className="mr-1.5 h-4 w-4 text-muted-foreground" />
      <select
        value={currentLocale}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-transparent text-sm font-medium text-foreground cursor-pointer pr-4 focus:outline-none"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
