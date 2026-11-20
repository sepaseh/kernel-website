import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page, { generateMetadata } from "@/app/faq/[[...path]]/page";
import sitemap from "@/app/sitemap";

import { FaqApiError } from "./api";
import { Faq } from "./Faq";
import { resolveFaq } from "./server";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } =
    await import("@/i18n/catalog-data/locales/en.json");
  return {
    getTranslations: async () => createTranslator({ locale: "en", messages }),
  };
});
const items = Array.from({ length: 21 }, (_, index) => ({
  id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
  question: `Question ${index + 1}?`,
  answer: "<script>Plain text</script>\n\nپاسخ فارسی.",
  sort: index,
}));
beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEBSITE_URL", "https://website.example.test");
  vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      if (url.pathname === "/public/posts/sitemap")
        return Response.json({ items: [], total: 0 });
      const offset = Number(url.searchParams.get("offset")),
        size = Number(url.searchParams.get("size"));
      return Response.json({
        items: items.slice(offset, offset + size),
        total: items.length,
      });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function html(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

describe("server-rendered FAQ pages", () => {
  it("keeps the previous link but never points beyond the provider's maximum offset", async () => {
    const rendered = await html(
      await Faq({
        page: 500001,
        faqs: { items: items.slice(0, 20), total: 10000021 },
      }),
    );
    expect(rendered).toContain('href="/faq/page/500000"');
    expect(rendered).toContain('rel="prev"');
    expect(rendered).not.toContain('rel="next"');
    expect(rendered).not.toContain("/faq/page/500002");
  });
  it("renders twenty native disclosures, escaped multiline answers and crawlable pagination", async () => {
    const rendered = await html(await Page({ params: Promise.resolve({}) }));
    expect(rendered.match(/<details/g)).toHaveLength(20);
    expect(rendered.match(/<summary/g)).toHaveLength(20);
    expect(rendered).toContain("&lt;script&gt;Plain text&lt;/script&gt;\n\n");
    expect(rendered).not.toContain("<script>");
    expect(rendered).not.toContain("application/ld+json");
    expect(rendered).toContain("[unicode-bidi:plaintext]");
    expect(rendered).toContain('href="/faq/page/2"');
    expect(rendered).toContain('rel="next"');
    const second = await html(
      await Page({ params: Promise.resolve({ path: ["page", "2"] }) }),
    );
    expect(second).toContain("Question 21?");
    expect(second).toContain('href="/faq"');
    expect(second).not.toContain('rel="next"');
  });
  it("gives populated pages their own canonical metadata and honors global noindex", async () => {
    const props = { params: Promise.resolve({ path: ["page", "2"] }) };
    expect(await generateMetadata(props)).toMatchObject({
      title: { absolute: "FAQ · Page 2 · Kernel" },
      alternates: { canonical: "https://website.example.test/faq/page/2" },
      robots: { index: true },
    });
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false },
    });
  });
  it("redirects the explicit first page and returns true route failures before provider-invalid queries", async () => {
    await expect(resolveFaq(["page", "1"])).rejects.toThrow("REDIRECT:/faq");
    for (const path of [["bad"], ["page", "500002"], ["page", "00"]])
      await expect(resolveFaq(path)).rejects.toThrow("NOT_FOUND");
    expect(fetch).not.toHaveBeenCalled();
    await expect(resolveFaq(["page", "3"])).rejects.toThrow("NOT_FOUND");
  });
  it("keeps an empty first page useful and non-indexed while preserving provider errors", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ items: [], total: 0 }),
    );
    expect(await html(await Page({ params: Promise.resolve({}) }))).toContain(
      "There are no published questions yet.",
    );
    expect(
      await generateMetadata({ params: Promise.resolve({}) }),
    ).toMatchObject({ robots: { index: false } });
    vi.mocked(fetch).mockImplementation(
      async () => new Response(undefined, { status: 503 }),
    );
    await expect(resolveFaq()).rejects.toBeInstanceOf(FaqApiError);
  });
});

describe("FAQ discovery", () => {
  it("includes FAQ only while populated and does not invent a modification time", async () => {
    expect(await sitemap()).toEqual([
      { url: "https://website.example.test/" },
      { url: "https://website.example.test/contact" },
      { url: "https://website.example.test/faq" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3100/public/faqs?offset=0&size=1"),
      expect.any(Object),
    );
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ items: [], total: 0 }),
    );
    expect(await sitemap()).toEqual([
      { url: "https://website.example.test/" },
      { url: "https://website.example.test/contact" },
    ]);
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    vi.mocked(fetch).mockClear();
    expect(await sitemap()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["/public/faqs", "/public/posts/sitemap"])(
    "never masks an unavailable %s with other static entries",
    async (failed) => {
      vi.mocked(fetch).mockImplementation(async (url) =>
        new URL(String(url)).pathname === failed
          ? new Response(undefined, { status: 503 })
          : Response.json({ items: [], total: 0 }),
      );
      await expect(sitemap()).rejects.toMatchObject({ status: 503 });
    },
  );
});
