import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { loadBlogSitemap } from "@/features/blog/api";
import { articlePath } from "@/features/blog/paths";
import { loadFaqs } from "@/features/faq/api";
import { readSeoConfig } from "@/shared/seo/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const { indexable, url } = readSeoConfig();
  if (!indexable || !url) return [];

  const [posts, faqs] = await Promise.all([loadBlogSitemap(), loadFaqs(1, 1)]);
  return [
    { url: new URL("/", url).href },
    { url: new URL("/contact", url).href },
    ...(posts.length ? [{ url: new URL("/blog", url).href }] : []),
    ...(faqs.total ? [{ url: new URL("/faq", url).href }] : []),
    ...posts.map((post) => ({
      url: new URL(articlePath(post), url).href,
      lastModified: post.public_updated_at,
    })),
  ];
}
