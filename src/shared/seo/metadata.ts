import type { Metadata } from "next";

import {
  containsAsciiControl,
  readSeoConfig,
  type WebsiteSeoConfig,
} from "./config";

type PageMetadata = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
};

function normalizedPath(value: string) {
  const invalid = () =>
    new Error(
      "SEO page path must be an absolute pathname without a scheme, query, fragment or traversal.",
    );
  if (
    !value.startsWith("/") ||
    value.includes("//") ||
    /[?#\\]/.test(value) ||
    containsAsciiControl(value, true)
  )
    throw invalid();
  for (const segment of value.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw invalid();
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      /[/\\?#]/.test(decoded) ||
      containsAsciiControl(decoded)
    )
      throw invalid();
  }
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

export function createPageMetadata(
  { title, description, path, index }: PageMetadata,
  config: WebsiteSeoConfig = readSeoConfig(),
): Metadata {
  const pathname = normalizedPath(path);
  const indexable = config.indexable && index !== false;
  const canonical = config.url ? new URL(pathname, config.url).href : undefined;
  const image = config.url
    ? new URL("/social-image", config.url).href
    : undefined;

  return {
    title: { absolute: title },
    description,
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: "Kernel",
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      ...(image
        ? { images: [{ url: image, width: 1200, height: 630, alt: title }] }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
  };
}
