import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { Account } from "@/features/account";
import { selectClientMessages } from "@/i18n/client-messages";
import { getWebsiteLanguage } from "@/shared/settings/server";
export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("account"), robots: { index: false, follow: false } };
}
export default async function Page() {
  const [{ code: locale }, messages] = await Promise.all([
    getWebsiteLanguage(),
    getMessages(),
  ]);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={selectClientMessages(messages, "account")}
    >
      <Account />
    </NextIntlClientProvider>
  );
}
