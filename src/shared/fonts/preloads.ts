import type { LocaleCode } from "@/i18n/catalog-data/locales";

import manifest from "./manifest.json";

// Only the configured site's alphabet is preloaded. unicode-range lets the
// browser request another subset when mixed-language user content needs it.
export function websiteFontPreloads(locale: LocaleCode): string[] {
  const files = [manifest.subsets.latin.href];
  if (locale === "fa" || locale === "ar")
    files.push(manifest.subsets.arabic.href);
  return files;
}
