import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { loadBlogSitemap } from "@/features/blog/api";
import { articlePath } from "@/features/blog/paths";
import { readSeoConfig } from "@/shared/seo/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const { indexable, url } = readSeoConfig();
  if (!indexable || !url) return [];

  const posts = await loadBlogSitemap();
  return [
    { url: new URL("/", url).href },
    ...(posts.length ? [{ url: new URL("/blog", url).href }] : []),
    ...posts.map((post) => ({
      url: new URL(articlePath(post), url).href,
      lastModified: post.public_updated_at,
    })),
  ];
}
