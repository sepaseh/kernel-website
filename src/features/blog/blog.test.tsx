// @vitest-environment node
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArticlePage, {
  generateMetadata as articlePageMetadata,
} from "@/app/[postId]/[title]/page";
import ShortPage from "@/app/[postId]/page";
import BlogPage, {
  generateMetadata as blogMetadata,
} from "@/app/blog/[[...path]]/page";
import PreviewPage, {
  generateMetadata as previewMetadata,
} from "@/app/preview/[postId]/article/page";
import sitemap from "@/app/sitemap";

import { Archive } from "./Archive";
import { Article } from "./Article";
import { sanitizeArticleHtml } from "./content";
import {
  archivePath,
  articlePath,
  isFileId,
  isPostCode,
  parseArchivePath,
} from "./paths";
import { articleBreadcrumbJsonLd, articleJsonLd, articleMetadata } from "./seo";
import { resolveArchive, resolveArticle } from "./server";
import type { BlogArticle } from "./types";

const framework = vi.hoisted(() => ({
  token: undefined as string | undefined,
  language: { code: "en", direction: "ltr", calendar: "gregorian" } as {
    code: string;
    direction: "ltr" | "rtl";
    calendar: "gregorian" | "jalali";
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (framework.token ? { value: framework.token } : undefined),
  }),
  headers: async () => new Headers({ "x-kernel-csp-nonce": "aB9+".repeat(6) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("@/shared/settings/server", () => ({
  getWebsiteLanguage: async () => framework.language,
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } =
    await import("@/i18n/catalog-data/locales/en.json");
  return {
    getTranslations: async () => createTranslator({ locale: "en", messages }),
  };
});
const category = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Useful notes",
  description: "A useful category.",
};
const article: BlogArticle = {
  id: 48629173,
  title: "A useful article",
  url_title: "a-useful-article",
  excerpt: "A concise summary.",
  body: "<h2>Useful content</h2><p>A readable article.</p>",
  tags: [{ id: "22222222-2222-4222-8222-222222222222", name: "Ideas" }],
  category,
  cover_image: {
    id: "33333333-3333-4333-8333-333333333333",
    content_type: "image/png",
    width: 1200,
    height: 630,
  },
  published_at: "2026-11-01T09:00:00.000Z",
  public_updated_at: "2026-11-02T09:00:00.000Z",
};
beforeEach(() => {
  framework.token = undefined;
  framework.language = { code: "en", direction: "ltr", calendar: "gregorian" };
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEBSITE_URL", "https://website.example.test");
  vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      if (url.pathname === "/public/posts/sitemap")
        return Response.json({ items: [article], total: 1 });
      if (url.pathname.startsWith("/public/posts/"))
        return Response.json(article);
      if (url.pathname.startsWith("/public/categories/"))
        return Response.json(category);
      return Response.json({ items: [article], total: 13 });
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());
async function html(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

describe("code-only canonical article routing", () => {
  it("looks up by code before redirecting missing or incorrect title suffixes", async () => {
    for (const title of [undefined, "outdated-title"]) {
      await expect(resolveArticle(String(article.id), title)).rejects.toThrow(
        "REDIRECT:" + articlePath(article),
      );
      expect(fetch).toHaveBeenCalledWith(
        new URL("http://127.0.0.1:3100/public/posts/" + article.id),
        expect.any(Object),
      );
    }
    expect(
      await resolveArticle(String(article.id), article.url_title),
    ).toMatchObject({ id: article.id });
    await expect(
      ShortPage({ params: Promise.resolve({ postId: String(article.id) }) }),
    ).rejects.toThrow("REDIRECT:");
  });
  it("does not disclose an unpublished title in a redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 404 })),
    );
    await expect(
      resolveArticle(String(article.id), "old-title"),
    ).rejects.toThrow("NOT_FOUND");
    await expect(resolveArticle("invalid", "anything")).rejects.toThrow(
      "NOT_FOUND",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 503 })),
    );
    await expect(resolveArticle(String(article.id))).rejects.toMatchObject({
      status: 503,
    });
  });
  it("composes the actual canonical article page and metadata", async () => {
    const props = {
      params: Promise.resolve({
        postId: String(article.id),
        title: article.url_title,
      }),
    };
    expect(await articlePageMetadata(props)).toMatchObject({
      alternates: {
        canonical: "https://website.example.test" + articlePath(article),
      },
    });
    const rendered = await html(await ArticlePage(props));
    expect(rendered).toContain("A readable article.");
    expect(rendered).toContain("A useful article");
  });
});

describe("archive navigation", () => {
  it.each([
    { path: undefined },
    { path: [] },
    { path: ["page", "2"] },
    { path: ["categories", category.id] },
    { path: ["categories", category.id, "page", "2"] },
  ])("accepts declared archive paths %#", ({ path }) => {
    expect(parseArchivePath(path)).toBeDefined();
  });
  it.each(
    [
      ["unknown"],
      ["page", "0"],
      ["page", "01"],
      ["page", "2", "extra"],
      ["categories"],
      ["categories", "bad"],
      ["page", "99999999999999999"],
    ].map((path) => ({ path })),
  )("rejects invalid archive paths %#", async ({ path }) => {
    expect(parseArchivePath(path)).toBeUndefined();
    await expect(resolveArchive(path)).rejects.toThrow("NOT_FOUND");
  });
  it("uses self-canonical pages and a category's own archive", async () => {
    expect(archivePath(2, category.id)).toBe(
      "/blog/categories/" + category.id + "/page/2",
    );
    expect(await resolveArchive(["page", "2"])).toMatchObject({
      page: 2,
      path: "/blog/page/2",
    });
    const props = {
      params: Promise.resolve({ path: ["categories", category.id] }),
    };
    expect(await blogMetadata(props)).toMatchObject({
      title: { absolute: "Useful notes · Kernel" },
      alternates: {
        canonical:
          "https://website.example.test/blog/categories/" + category.id,
      },
    });
    const rendered = await html(await BlogPage(props));
    expect(rendered).toContain(category.description);
    expect(rendered).toContain(articlePath(article));
    expect(rendered).toContain('rel="next"');
  });
  it("capitalizes the English Blog heading and metadata while keeping its lowercase route", async () => {
    const props = { params: Promise.resolve({}) };
    expect(await html(await BlogPage(props))).toMatch(/<h1[^>]*>Blog<\/h1>/);
    expect(await blogMetadata(props)).toMatchObject({
      title: { absolute: "Blog · Kernel" },
      alternates: { canonical: "https://website.example.test/blog" },
    });
  });
  it("canonicalizes explicit first pages and rejects out-of-range pages", async () => {
    await expect(resolveArchive(["page", "1"])).rejects.toThrow(
      "REDIRECT:/blog",
    );
    await expect(resolveArchive(["page", "3"])).rejects.toThrow("NOT_FOUND");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 404 })),
    );
    await expect(resolveArchive(["categories", category.id])).rejects.toThrow(
      "NOT_FOUND",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 503 })),
    );
    await expect(
      resolveArchive(["categories", category.id]),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("renders empty, previous, next and unclassified cards with native crawlable links", async () => {
    const empty = await html(
      await Archive({ page: 1, posts: { items: [], total: 0 } }),
    );
    expect(empty).toContain("No articles have been published yet.");
    expect(empty).not.toContain('rel="next"');
    const bare = {
      ...article,
      category: undefined,
      cover_image: undefined,
      published_at: undefined,
    };
    const second = await html(
      await Archive({
        page: 2,
        category: { ...category, description: "" },
        posts: { items: [bare], total: 13 },
      }),
    );
    expect(second).toContain('rel="prev"');
    expect(second).not.toContain('rel="next"');
    expect(second).toContain("Practical ideas and stories");
    const full = await html(
      await Archive({ page: 1, posts: { items: [article], total: 13 } }),
    );
    expect(full).toContain('loading="lazy"');
    expect(full).toContain("/media/" + article.cover_image!.id);
  });
});

describe("safe HTML, automatic metadata and structured data", () => {
  it("retains recognized Quill formatting while removing executable markup and foreign image URLs", () => {
    const dirty =
      '<h1>Title</h1><p class="ql-align-center evil" onclick="attack()">Text</p><script>attack()</script><iframe src="https://evil.test">attack</iframe><a href="javascript:attack()">bad</a><a href="https://example.test" target="_blank">good</a><img src="https://evil.test/tracker"><img data-file-id="' +
      article.cover_image!.id +
      '" src="https://evil.test/ignored" width="1200" height="630" onerror="attack()"><img data-file-id="' +
      article.cover_image!.id +
      '" width="wrong" height="-1">';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).toContain('<h2 dir="auto">Title</h2>');
    expect(clean).toContain('class="ql-align-center"');
    expect(clean).toContain('src="/media/' + article.cover_image!.id + '"');
    expect(clean).toContain('width="1200"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).not.toMatch(
      /attack|javascript|iframe|onerror|onclick|evil\.test|wrong|height="-1"|target=/,
    );
    expect(clean).not.toContain('class="evil"');
  });
  it("isolates each content block from the shell direction while preserving explicit editor direction", async () => {
    const body =
      '<p>English sentence.</p><p>یک جملهٔ فارسی.</p><p dir="ltr">Explicit left.</p><p dir="rtl">جهت راست.</p><p dir="auto">Automatic.</p><p dir="invalid">Fallback.</p><p class="ql-direction-rtl">Editor right.</p>';
    const clean = sanitizeArticleHtml(body);
    expect(clean).toContain('<p dir="auto">English sentence.</p>');
    expect(clean).toContain('<p dir="auto">یک جملهٔ فارسی.</p>');
    expect(clean).toContain('<p dir="ltr">Explicit left.</p>');
    expect(clean).toContain('<p dir="rtl">جهت راست.</p>');
    expect(clean).toContain('<p dir="auto">Automatic.</p>');
    expect(clean).toContain('<p dir="auto">Fallback.</p>');
    expect(clean).toContain(
      '<p class="ql-direction-rtl" dir="rtl">Editor right.</p>',
    );
    for (const code of ["en", "fa"]) {
      framework.language = {
        code,
        direction: code === "fa" ? "rtl" : "ltr",
        calendar: "gregorian",
      };
      const rendered = await html(
        await Article({ post: { ...article, body } }),
      );
      expect(rendered).toContain(clean);
      expect(rendered).toMatch(/<h1 dir="auto"/);
      expect(rendered).toMatch(/<p dir="auto" class="mt-7/);
    }
  });
  it("derives article social metadata and factual JSON-LD without inventing an author", () => {
    expect(articleMetadata(article)).toMatchObject({
      description: article.excerpt,
      openGraph: {
        type: "article",
        images: [
          {
            url:
              "https://website.example.test/media/" + article.cover_image!.id,
            alt: article.title,
            width: 1200,
            height: 630,
          },
        ],
      },
    });
    const data = articleJsonLd(article, "fa");
    expect(data).toMatchObject({
      "@type": "BlogPosting",
      inLanguage: "fa",
      datePublished: article.published_at,
      dateModified: article.public_updated_at,
    });
    expect(data).not.toHaveProperty("author");
    expect(
      articleBreadcrumbJsonLd(article, { home: "Home", blog: "blog" }),
    ).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: expect.arrayContaining([
        expect.objectContaining({ name: category.name }),
      ]),
    });
    const bare = {
      ...article,
      category: undefined,
      cover_image: undefined,
      published_at: undefined,
      public_updated_at: undefined,
    };
    expect(articleMetadata(bare).openGraph).toMatchObject({
      images: [{ url: "https://website.example.test/social-image" }],
    });
    expect(articleJsonLd(bare, "en")).not.toHaveProperty("datePublished");
    expect(
      articleBreadcrumbJsonLd(bare, { home: "Home", blog: "blog" })
        ?.itemListElement,
    ).toHaveLength(3);
    const legacy = {
      ...article,
      cover_image: {
        ...article.cover_image!,
        width: undefined,
        height: undefined,
      },
    };
    expect(articleMetadata(legacy).openGraph).toMatchObject({
      images: [{ alt: article.title }],
    });
    expect(articleJsonLd(article, "en", { indexable: false })).toBeUndefined();
    expect(
      articleBreadcrumbJsonLd(
        article,
        { home: "Home", blog: "blog" },
        { indexable: false },
      ),
    ).toBeUndefined();
  });
  it("renders semantic article details, nonce-bearing escaped JSON-LD and text-only tags", async () => {
    const rendered = await html(await Article({ post: article }));
    expect(rendered).toContain('nonce="aB9+'.repeat(1));
    expect(rendered).toContain('"@type":"BlogPosting"');
    expect(rendered).toContain('"@type":"BreadcrumbList"');
    expect(rendered).toContain("Ideas");
    expect(rendered).not.toContain("/tags/");
    const sparse = await html(
      await Article({
        post: {
          ...article,
          title: "",
          category: undefined,
          cover_image: undefined,
          excerpt: "",
          published_at: undefined,
          public_updated_at: undefined,
          tags: [],
        },
        preview: true,
      }),
    );
    expect(sparse).toContain("Working-copy preview");
    expect(sparse).not.toContain("application/ld+json");
    expect(sparse).not.toContain("<img");
    const identical = await html(
      await Article({
        post: { ...article, public_updated_at: article.published_at },
      }),
    );
    expect(identical).not.toContain("Updated");
    vi.stubEnv("WEBSITE_URL", "");
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    expect(await html(await Article({ post: article }))).not.toContain(
      "application/ld+json",
    );
  });
  it("uses the configured calendar independently of the language in articles and cards", async () => {
    framework.language = {
      code: "fa",
      direction: "rtl",
      calendar: "gregorian",
    };
    const gregorian = await html(await Article({ post: article }));
    expect(gregorian).toContain("۲۰۲۶");
    expect(gregorian).not.toContain("۱۴۰۵");
    framework.language = { code: "en", direction: "ltr", calendar: "jalali" };
    const jalali = await html(
      await Archive({ page: 1, posts: { items: [article], total: 1 } }),
    );
    expect(jalali).toContain("1405");
    expect(jalali).not.toContain(">2026");
  });
  it("publishes only current canonical article URLs with real lastModified values", async () => {
    expect(await sitemap()).toEqual([
      { url: "https://website.example.test/" },
      { url: "https://website.example.test/blog" },
      {
        url: "https://website.example.test" + articlePath(article),
        lastModified: article.public_updated_at,
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ items: [], total: 0 })),
    );
    expect(await sitemap()).toEqual([{ url: "https://website.example.test/" }]);
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    expect(await sitemap()).toEqual([]);
  });
  it("rejects sitemap generation when the published-post read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 503 })),
    );
    await expect(sitemap()).rejects.toMatchObject({ status: 503 });
  });
});

describe("authorized clean-URL preview rendering", () => {
  it("requires a post-scoped cookie and fresh API authorization, excluding public metadata", async () => {
    await expect(
      PreviewPage({ params: Promise.resolve({ postId: "bad" }) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      PreviewPage({ params: Promise.resolve({ postId: String(article.id) }) }),
    ).rejects.toThrow("NOT_FOUND");
    framework.token = "short-lived-scoped-token";
    expect(
      await html(
        await PreviewPage({
          params: Promise.resolve({ postId: String(article.id) }),
        }),
      ),
    ).toContain("Working-copy preview");
    expect(await previewMetadata()).toMatchObject({
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
    for (const status of [401, 403, 404]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(undefined, { status })),
      );
      await expect(
        PreviewPage({
          params: Promise.resolve({ postId: String(article.id) }),
        }),
      ).rejects.toThrow("NOT_FOUND");
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(undefined, { status: 503 })),
    );
    await expect(
      PreviewPage({ params: Promise.resolve({ postId: String(article.id) }) }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("validates numeric codes and UUID wire identifiers rather than accepting path fragments", () => {
    expect(isPostCode("48629173")).toBe(true);
    expect(isPostCode("04862917")).toBe(false);
    expect(isFileId(category.id)).toBe(true);
    expect(isFileId("../evil")).toBe(false);
  });
});
