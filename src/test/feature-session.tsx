import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth/SessionProvider";
import en from "@/i18n/catalog-data/locales/en";
import fa from "@/i18n/catalog-data/locales/fa";
import { selectClientMessages } from "@/i18n/client-messages";
import type { Account } from "@/shared/contracts";

const testCatalogs = { en, fa };
type FeatureTestProviderProps = {
  children?: ReactNode;
  locale?: keyof typeof testCatalogs;
  scope?: Exclude<Parameters<typeof selectClientMessages>[1], "root">;
};

export function FeatureTestProvider({
  children,
  locale = "en",
  scope = "auth",
}: FeatureTestProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={selectClientMessages(testCatalogs[locale], scope)}
      timeZone="UTC"
    >
      <SessionProvider>{children}</SessionProvider>
    </NextIntlClientProvider>
  );
}

export const accountFixture = (overrides: Partial<Account> = {}): Account => ({
  id: "synthetic-account",
  first_name: "Ada",
  last_name: "Lovelace",
  mobile: "09120000000",
  email: "ada@example.test",
  username: "ada",
  is_system_admin: false,
  permissions: [],
  status: "active",
  ...overrides,
});
