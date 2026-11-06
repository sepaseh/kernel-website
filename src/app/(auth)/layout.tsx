import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { selectClientMessages } from "@/i18n/client-messages";
import { getWebsiteLanguage } from "@/shared/settings/server";
type Props = Readonly<{ children: ReactNode }>;

export default async function Layout({ children }: Props) {
  const [{ code: locale }, messages] = await Promise.all([
    getWebsiteLanguage(),
    getMessages(),
  ]);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={selectClientMessages(messages, "auth")}
    >
      <AuthLayout>{children}</AuthLayout>
    </NextIntlClientProvider>
  );
}
