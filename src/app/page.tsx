import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getRequestNonce } from "@/shared/security/nonce";
import { readSeoConfig } from "@/shared/seo/config";
import { createPageMetadata } from "@/shared/seo/metadata";
import {
  createWebsiteJsonLd,
  serializeJsonLd,
} from "@/shared/seo/structured-data";
import { getWebsiteLanguage } from "@/shared/settings/server";
import { Home } from "@/website/home/Home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return createPageMetadata({
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    path: "/",
  });
}

export default async function Page() {
  const [t, { code }, nonce] = await Promise.all([
    getTranslations(),
    getWebsiteLanguage(),
    getRequestNonce(),
  ]);
  const website = createWebsiteJsonLd(
    { name: "Kernel", description: t("metadataDescription"), language: code },
    readSeoConfig(),
  );
  return (
    <>
      {website && (
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(website) }}
        />
      )}
      <Home />
    </>
  );
}
