import type { LocaleCode } from "@/i18n/catalog-data/locales";

export const catalogs = {
  ar: () => import("@/i18n/catalog-data/locales/ar"),
  de: () => import("@/i18n/catalog-data/locales/de"),
  en: () => import("@/i18n/catalog-data/locales/en"),
  es: () => import("@/i18n/catalog-data/locales/es"),
  fa: () => import("@/i18n/catalog-data/locales/fa"),
  fr: () => import("@/i18n/catalog-data/locales/fr"),
  it: () => import("@/i18n/catalog-data/locales/it"),
  pt: () => import("@/i18n/catalog-data/locales/pt"),
  ru: () => import("@/i18n/catalog-data/locales/ru"),
  tr: () => import("@/i18n/catalog-data/locales/tr"),
} satisfies Record<LocaleCode, () => Promise<{ default: object }>>;
