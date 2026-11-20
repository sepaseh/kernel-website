import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlogApiError,
  loadArticle,
  loadBlogSitemap,
  loadCategory,
  loadPosts,
} from "./api";
vi.mock("server-only", () => ({}));
const category = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Notes",
  description: "Useful notes",
};
const post = {
  id: 48629173,
  title: "A useful article",
  url_title: "a-useful-article",
  excerpt: "A concise summary.",
  body: "<p>Published content</p>",
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
const respond = (value: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(value)),
  );
beforeEach(() => vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100"));
afterEach(() => vi.unstubAllEnvs());

describe("anonymous published-content reader", () => {
  it("reads only published projections with bounded pagination and no visitor credentials", async () => {
    respond({ items: [post], total: 13 });
    expect(await loadPosts(2, category.id)).toMatchObject({
      total: 13,
      items: [{ id: post.id, title: post.title }],
    });
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        `http://127.0.0.1:3100/public/posts?offset=12&size=12&category_id=${category.id}`,
      ),
      expect.objectContaining({
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    const result = await loadPosts();
    expect(result.items[0]).not.toHaveProperty("body");
  });
  it("keeps category reads and public detail lookup scoped to validated IDs", async () => {
    respond(category);
    expect(await loadCategory(category.id)).toEqual(category);
    await expect(loadCategory("untrusted/path")).rejects.toMatchObject({
      status: 404,
    });
    respond({ ...category, id: "44444444-4444-4444-8444-444444444444" });
    await expect(loadCategory(category.id)).rejects.toMatchObject({
      status: 503,
    });
    respond({ ...post, account: { password: "must not escape" } });
    const result = await loadArticle(String(post.id));
    expect(result.body).toBe(post.body);
    expect(result).not.toHaveProperty("account");
    await expect(loadArticle("123")).rejects.toMatchObject({ status: 404 });
    respond({ ...post, id: 48629174 });
    await expect(loadArticle(String(post.id))).rejects.toMatchObject({
      status: 503,
    });
  });
  it("uses a post capability only for preview, including never-published incomplete drafts", async () => {
    respond({
      ...post,
      title: "",
      cover_image: undefined,
      category: undefined,
      published_at: undefined,
      public_updated_at: undefined,
    });
    expect(
      await loadArticle(String(post.id), "scoped-capability"),
    ).toMatchObject({ title: "", published_at: undefined });
    expect(fetch).toHaveBeenCalledWith(
      new URL(`http://127.0.0.1:3100/public/posts/${post.id}/preview`),
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer scoped-capability",
        },
      }),
    );
  });
  it.each([401, 403, 404, 429, 500])(
    "keeps missing/denied content separate from an upstream %s outage",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("private failure details", { status })),
      );
      await expect(loadArticle(String(post.id))).rejects.toMatchObject({
        status: [401, 403, 404].includes(status) ? status : 503,
        message: "The article service is unavailable.",
      });
    },
  );
  it.each([
    undefined,
    [],
    {},
    { ...post, id: "48629173" },
    { ...post, id: 123 },
    { ...post, id: 123456789 },
    { ...post, url_title: "" },
    { ...post, url_title: "unsafe/path" },
    { ...post, url_title: "unsafe title" },
    { ...post, title: 42 },
    { ...post, title: " " },
    { ...post, tags: {} },
    { ...post, tags: [null] },
    { ...post, tags: [{ id: "bad", name: "Tag" }] },
    { ...post, published_at: undefined },
    { ...post, published_at: "not-a-date" },
    { ...post, public_updated_at: "invalid" },
    {
      ...post,
      cover_image: { ...post.cover_image, content_type: "image/svg+xml" },
    },
    { ...post, cover_image: { ...post.cover_image, width: 0 } },
    { ...post, cover_image: { ...post.cover_image, height: -1 } },
    { ...post, category: { ...category, name: null } },
    { ...post, body: null },
  ])("rejects malformed successful article data %#", async (value) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(value) ?? "null")),
    );
    await expect(loadArticle(String(post.id))).rejects.toBeInstanceOf(
      BlogApiError,
    );
  });
  it("accepts an image without legacy dimensions without inventing them", async () => {
    respond({
      ...post,
      cover_image: { id: post.cover_image.id, content_type: "image/jpeg" },
    });
    expect((await loadArticle(String(post.id))).cover_image).toEqual({
      id: post.cover_image.id,
      content_type: "image/jpeg",
      width: undefined,
      height: undefined,
    });
  });
  it.each([
    { items: {}, total: 0 },
    { items: Array(13).fill(post), total: 13 },
    { items: [], total: -1 },
    { items: [], total: 0.5 },
    { items: [], total: "1" },
  ])("rejects a malformed list %#", async (value) => {
    respond(value);
    await expect(loadPosts()).rejects.toBeInstanceOf(BlogApiError);
  });
  it("preserves fetch/JSON failures and rejects empty or oversized successful bodies", async () => {
    const failure = new Error("Synthetic transport failure");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw failure;
      }),
    );
    await expect(loadPosts()).rejects.toBe(failure);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not JSON")),
    );
    await expect(loadPosts()).rejects.toBeInstanceOf(SyntaxError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response()),
    );
    await expect(loadPosts()).rejects.toMatchObject({ status: 503 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(2 * 1024 * 1024 + 1))),
    );
    await expect(loadPosts()).rejects.toMatchObject({ status: 503 });
  });
});

describe("published sitemap traversal", () => {
  const entry = {
    id: post.id,
    url_title: post.url_title,
    public_updated_at: post.public_updated_at,
  };
  it("accepts all 49,998 articles that leave the two static sitemap slots", async () => {
    const total = 49998;
    const fetcher = vi.fn(async (url: URL) => {
      const offset = Number(url.searchParams.get("offset"));
      return Response.json({
        items: Array.from(
          { length: Math.min(1000, total - offset) },
          (_, index) => ({
            ...entry,
            id: 10000000 + offset + index,
          }),
        ),
        total,
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await loadBlogSitemap();
    expect(result).toHaveLength(total);
    expect(result[0].id).toBe(10000000);
    expect(result.at(-1)?.id).toBe(10049997);
    expect(fetcher).toHaveBeenCalledTimes(50);
    expect(fetcher.mock.calls.at(-1)?.[0]).toEqual(
      new URL(
        "http://127.0.0.1:3100/public/posts/sitemap?offset=49000&size=1000",
      ),
    );
  });
  it("rejects the first invalid total 49,999 before requesting any follow-up page", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          items: Array.from({ length: 1000 }, (_, index) => ({
            ...entry,
            id: 10000000 + index,
          })),
          total: 49999,
        }),
      )
      .mockRejectedValue(new Error("Unexpected follow-up request"));
    vi.stubGlobal("fetch", fetcher);
    await expect(loadBlogSitemap()).rejects.toBeInstanceOf(BlogApiError);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("reads every page and retains actual public modification dates", async () => {
    const items = Array.from({ length: 1001 }, (_, index) => ({
      ...entry,
      id: 10000000 + index,
    }));
    const fetcher = vi.fn(async (url: URL) =>
      Response.json({
        items: items.slice(
          Number(url.searchParams.get("offset")),
          Number(url.searchParams.get("offset")) + 1000,
        ),
        total: items.length,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await loadBlogSitemap()).toEqual(items);
    expect(fetcher).toHaveBeenCalledTimes(2);
    respond({ items: [], total: 0 });
    expect(await loadBlogSitemap()).toEqual([]);
  });
  it.each([
    { items: [], total: 1 },
    { items: [], total: 50000 },
    { items: {}, total: 0 },
    { items: [entry, entry], total: 2 },
    { items: [entry], total: 0 },
    { items: [{ ...entry, id: 1 }], total: 1 },
    { items: [{ ...entry, url_title: "../evil" }], total: 1 },
    { items: [{ ...entry, public_updated_at: undefined }], total: 1 },
    { items: Array(1001).fill(entry), total: 1001 },
  ])(
    "fails instead of silently publishing an invalid or truncated sitemap %#",
    async (value) => {
      respond(value);
      await expect(loadBlogSitemap()).rejects.toBeInstanceOf(BlogApiError);
    },
  );
});
