import { getRequestConfig } from "next-intl/server";

import { getWebsiteLanguage } from "@/shared/settings/server";

import { catalogs } from "./catalogs";

export default getRequestConfig(async () => {
  const { code: locale } = await getWebsiteLanguage();
  return { locale, messages: (await catalogs[locale]()).default };
});
