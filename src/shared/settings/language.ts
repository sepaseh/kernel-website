import { type LocaleCode, localeCodes } from "@/i18n/catalog-data/locales";
import { getApiBaseUrl } from "@/shared/api/origin";

import { type PublicSettingsResponse, SettingsPaths } from "./contracts";

type WebsiteLanguage = Pick<PublicSettingsResponse["language"], "direction"> & {
  code: LocaleCode;
};

export class WebsiteSettingsError extends Error {
  constructor(
    readonly reason:
      | "unavailable"
      | "invalid-settings"
      | "unsupported-language"
      | "invalid-api-origin",
  ) {
    const messages = {
      unavailable: "The application settings are temporarily unavailable.",
      "invalid-settings": "The application language settings are invalid.",
      "unsupported-language": `The configured application language has no website translation catalog. Supported languages: ${localeCodes.join(", ")}.`,
      "invalid-api-origin": "The API connection is not configured.",
    };
    super(messages[reason]);
    this.name = "WebsiteSettingsError";
  }
}

function readLanguage(value: unknown): WebsiteLanguage {
  if (!value || typeof value !== "object" || !("language" in value)) {
    throw new WebsiteSettingsError("invalid-settings");
  }
  const language = value.language;
  if (!language || typeof language !== "object" || !("code" in language)) {
    throw new WebsiteSettingsError("invalid-settings");
  }
  const code = language.code;
  if (typeof code !== "string" || !code) {
    throw new WebsiteSettingsError("invalid-settings");
  }
  const locale = localeCodes.find((locale) => locale === code);
  if (!locale) {
    throw new WebsiteSettingsError("unsupported-language");
  }
  if (
    !("direction" in language) ||
    (language.direction !== "ltr" && language.direction !== "rtl")
  ) {
    throw new WebsiteSettingsError("invalid-settings");
  }
  return { code: locale, direction: language.direction };
}

export async function loadWebsiteLanguage(): Promise<WebsiteLanguage> {
  let base: URL;
  try {
    base = getApiBaseUrl();
  } catch {
    throw new WebsiteSettingsError("invalid-api-origin");
  }

  let value: unknown;
  try {
    // This public read intentionally carries no visitor cookies or language headers.
    const response = await fetch(new URL(SettingsPaths.get, base), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new WebsiteSettingsError("unavailable");
    value = await response.json();
  } catch {
    throw new WebsiteSettingsError("unavailable");
  }
  return readLanguage(value);
}
