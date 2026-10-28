import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { readSeoConfig } from "@/shared/seo/config";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const { indexable, url } = readSeoConfig();
  return {
    // Crawlers must be able to read page-level noindex, including in previews.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(indexable && url ? { sitemap: new URL("/sitemap.xml", url).href } : {}),
  };
}
