import "./globals.css";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/app/providers/Providers";
import { selectClientMessages } from "@/i18n/client-messages";
import { websiteFontPreloads } from "@/shared/fonts/preloads";
import { WebVitals } from "@/shared/performance/WebVitals";
import { getRequestNonce } from "@/shared/security/nonce";
import { readSeoConfig } from "@/shared/seo/config";
import { getWebsiteLanguage } from "@/shared/settings/server";
import { Footer } from "@/website/layouts/Footer";
import { Header } from "@/website/layouts/Header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const { url } = readSeoConfig();
  return {
    metadataBase: url,
    applicationName: "Kernel",
    title: {
      default: t("metadataTitle"),
      template: "%s · Kernel",
    },
    description: t("metadataDescription"),
    // Public pages opt in with their own canonical metadata. Utility and new
    // routes stay out of search until their publication policy is explicit.
    robots: { index: false, follow: true },
  };
}

type Props = Readonly<{ children: ReactNode }>;
export default async function RootLayout({ children }: Props) {
  const [nonce, { code: locale, direction }, messages, t] = await Promise.all([
    getRequestNonce(),
    getWebsiteLanguage(),
    getMessages(),
    getTranslations(),
  ]);
  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <head>
        {websiteFontPreloads(locale).map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        <WebVitals />
        <NextIntlClientProvider
          locale={locale}
          messages={selectClientMessages(messages, "root")}
        >
          <Providers nonce={nonce}>
            <div className="flex min-h-svh flex-col">
              <a
                href="#content"
                className="fixed start-4 top-3 z-50 -translate-y-24 rounded-lg bg-primary px-5 py-3 text-primary-foreground focus:translate-y-0"
              >
                {t("siteSkip")}
              </a>
              <Header />
              <main id="content" tabIndex={-1} className="outline-none">
                {children}
              </main>
              <Footer />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
