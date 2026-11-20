import type { Metadata } from "next";

import { readSeoConfig, type WebsiteSeoConfig } from "@/shared/seo/config";
import { createPageMetadata } from "@/shared/seo/metadata";

import { archivePath, articlePath, mediaPath } from "./paths";
import type { BlogArticle } from "./types";

export function articleMetadata(
  post: BlogArticle,
  config: WebsiteSeoConfig = readSeoConfig(),
): Metadata {
  const metadata = createPageMetadata(
    {
      title: `${post.title} · Kernel`,
      description: post.excerpt,
      path: articlePath(post),
    },
    config,
  );
  const cover = post.cover_image;
  const image =
    cover && config.url
      ? new URL(mediaPath(cover.id), config.url).href
      : undefined;
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.published_at,
      modifiedTime: post.public_updated_at,
      ...(image && cover
        ? {
            images: [
              {
                url: image,
                alt: post.title,
                ...(cover.width ? { width: cover.width } : {}),
                ...(cover.height ? { height: cover.height } : {}),
              },
            ],
          }
        : {}),
    },
    twitter: {
      ...metadata.twitter,
      ...(image
        ? {
            card: "summary_large_image",
            images: [{ url: image, alt: post.title }],
          }
        : {}),
    },
  };
}
export function articleJsonLd(
  post: BlogArticle,
  language: string,
  config: WebsiteSeoConfig = readSeoConfig(),
) {
  if (!config.url) return undefined;
  const url = new URL(articlePath(post), config.url).href;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": url,
    mainEntityOfPage: url,
    headline: post.title,
    description: post.excerpt,
    inLanguage: language,
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(post.public_updated_at ? { dateModified: post.public_updated_at } : {}),
    ...(post.cover_image
      ? { image: new URL(mediaPath(post.cover_image.id), config.url).href }
      : {}),
  };
}
export function articleBreadcrumbJsonLd(
  post: BlogArticle,
  labels: { home: string; blog: string },
  config: WebsiteSeoConfig = readSeoConfig(),
) {
  if (!config.url) return undefined;
  const items = [
    { name: labels.home, path: "/" },
    { name: labels.blog, path: "/blog" },
    ...(post.category
      ? [{ name: post.category.name, path: archivePath(1, post.category.id) }]
      : []),
    { name: post.title, path: articlePath(post) },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, config.url).href,
    })),
  };
}
