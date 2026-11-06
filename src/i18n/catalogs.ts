import type { LocaleCode } from "@/i18n/catalog-data/locales";
import type { WebsiteTranslationResource } from "@/i18n/catalog-data/website-types";

export const catalogs = {
  ar: () =>
    import("@/i18n/catalog-data/locales/ar.json", { with: { type: "json" } }),
  de: () =>
    import("@/i18n/catalog-data/locales/de.json", { with: { type: "json" } }),
  en: () =>
    import("@/i18n/catalog-data/locales/en.json", { with: { type: "json" } }),
  es: () =>
    import("@/i18n/catalog-data/locales/es.json", { with: { type: "json" } }),
  fa: () =>
    import("@/i18n/catalog-data/locales/fa.json", { with: { type: "json" } }),
  fr: () =>
    import("@/i18n/catalog-data/locales/fr.json", { with: { type: "json" } }),
  it: () =>
    import("@/i18n/catalog-data/locales/it.json", { with: { type: "json" } }),
  pt: () =>
    import("@/i18n/catalog-data/locales/pt.json", { with: { type: "json" } }),
  ru: () =>
    import("@/i18n/catalog-data/locales/ru.json", { with: { type: "json" } }),
  tr: () =>
    import("@/i18n/catalog-data/locales/tr.json", { with: { type: "json" } }),
} satisfies Record<
  LocaleCode,
  () => Promise<{ default: WebsiteTranslationResource }>
>;
