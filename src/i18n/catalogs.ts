import type { LocaleCode } from "@/i18n/catalog-data/locales";
import type { WebsiteTranslationResource } from "@/i18n/catalog-data/website-types";

export const catalogs = {
  ar: () => import("@/i18n/catalog-data/locales/ar.json"),
  de: () => import("@/i18n/catalog-data/locales/de.json"),
  en: () => import("@/i18n/catalog-data/locales/en.json"),
  es: () => import("@/i18n/catalog-data/locales/es.json"),
  fa: () => import("@/i18n/catalog-data/locales/fa.json"),
  fr: () => import("@/i18n/catalog-data/locales/fr.json"),
  it: () => import("@/i18n/catalog-data/locales/it.json"),
  pt: () => import("@/i18n/catalog-data/locales/pt.json"),
  ru: () => import("@/i18n/catalog-data/locales/ru.json"),
  tr: () => import("@/i18n/catalog-data/locales/tr.json"),
} satisfies Record<
  LocaleCode,
  () => Promise<{ default: WebsiteTranslationResource }>
>;
