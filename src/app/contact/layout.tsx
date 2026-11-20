import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { selectClientMessages } from "@/i18n/client-messages";
import { getWebsiteLanguage } from "@/shared/settings/server";

type Props = { children: ReactNode };
export default async function Layout({ children }: Props) {
  const [{ code }, messages] = await Promise.all([
    getWebsiteLanguage(),
    getMessages(),
  ]);
  return (
    <NextIntlClientProvider
      locale={code}
      messages={selectClientMessages(messages, "contact")}
    >
      {children}
    </NextIntlClientProvider>
  );
}
