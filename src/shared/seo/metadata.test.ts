import { describe, expect, it } from "vitest";

import { readSeoConfig } from "./config";
import { createPageMetadata } from "./metadata";

const page = {
  title: "ورود · Kernel",
  description: "توضیح صفحهٔ ورود",
  path: "/login/",
};
const production = readSeoConfig({
  WEBSITE_URL: "https://kernel.example:443/",
  WEBSITE_INDEXING_ENABLED: "true",
  NODE_ENV: "production",
});

describe("page-owned SEO metadata", () => {
  it("creates the normalized page's self-canonical and translated social cards", () => {
    expect(createPageMetadata(page, production)).toMatchObject({
      title: { absolute: page.title },
      description: page.description,
      alternates: { canonical: "https://kernel.example/login" },
      robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true },
      },
      openGraph: {
        type: "website",
        siteName: "Kernel",
        url: "https://kernel.example/login",
        title: page.title,
        description: page.description,
        images: [
          {
            url: "https://kernel.example/social-image",
            width: 1200,
            height: 630,
            alt: page.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: page.title,
        description: page.description,
        images: [
          { url: "https://kernel.example/social-image", alt: page.title },
        ],
      },
    });
  });

  it("allows a private/auth page to opt out of indexing while preserving follow", () => {
    expect(
      createPageMetadata({ ...page, index: false }, production).robots,
    ).toMatchObject({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
    expect(
      createPageMetadata(
        { ...page, index: true },
        { ...production, indexable: false },
      ).robots,
    ).toMatchObject({ index: false, googleBot: { index: false } });
  });

  it("does not invent a URL or image when an origin has not been configured", () => {
    const metadata = createPageMetadata(page, readSeoConfig({}));
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toEqual({
      type: "website",
      siteName: "Kernel",
      title: page.title,
      description: page.description,
    });
    expect(metadata.twitter).toEqual({
      card: "summary",
      title: page.title,
      description: page.description,
    });
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
    expect(JSON.stringify(metadata)).not.toMatch(/localhost|canonical|images/);
  });

  it("keeps root canonical distinct from child pages and encodes a valid Unicode pathname", () => {
    expect(
      createPageMetadata({ ...page, path: "/" }, production).alternates,
    ).toEqual({ canonical: "https://kernel.example/" });
    expect(
      createPageMetadata({ ...page, path: "/معرفی/" }, production).alternates,
    ).toEqual({ canonical: new URL("/معرفی", production.url).href });
  });

  it.each([
    "",
    "login",
    "//attacker.example",
    "/nested//path",
    "https://attacker.example",
    "javascript:alert(1)",
    "/login?next=evil",
    "/login#fragment",
    "/../account",
    "/safe/./account",
    "/safe/%2e%2e/account",
    "/%2E/account",
    "/%2f%2fattacker.example",
    "/%5cattacker.example",
    "/login%3fnext=evil",
    "/login%23fragment",
    "/login\\account",
    "/%00account",
    "/bad%escape",
    "/space path",
  ])("rejects an unsafe canonical pathname: %j", (path) => {
    expect(() => createPageMetadata({ ...page, path }, production)).toThrow(
      "SEO page path",
    );
    expect(() =>
      createPageMetadata({ ...page, path }, { indexable: false }),
    ).toThrow("SEO page path");
  });
});
