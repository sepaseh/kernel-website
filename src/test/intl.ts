import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";

import en from "../i18n/catalog-data/locales/en.json";
import fa from "../i18n/catalog-data/locales/fa.json";

export function TestIntlProvider({
  children,
  locale = "en",
}: {
  children?: ReactNode;
  locale?: "en" | "fa";
}) {
  return createElement(NextIntlClientProvider, {
    children,
    locale,
    messages: locale === "fa" ? fa : en,
    timeZone: "UTC",
  });
}
