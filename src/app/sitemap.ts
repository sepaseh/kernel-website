import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { readSeoConfig } from "@/shared/seo/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const { indexable, url } = readSeoConfig();
  if (!indexable || !url) return [];

  // Add only existing, published public pages. Use a real content update time
  // when one exists; a deployment or request timestamp is not lastModified.
  return [{ url: new URL("/", url).href }];
}
