import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/preview/[postId]/route";

vi.mock("server-only", () => ({}));
const article = {
  id: 48629173,
  title: "Working article",
  url_title: "working-article",
  body: "<p>Private text.</p>",
  excerpt: "Private summary.",
  tags: [],
};
const token = "one-post-scoped-capability";
afterEach(() => vi.unstubAllEnvs());
const run = (
  url = `https://website.example.test/preview/${article.id}?token=${token}`,
  postId = String(article.id),
) => GET(new Request(url), { params: Promise.resolve({ postId }) });
describe("private preview capability exchange", () => {
  it("validates the capability before setting a short-lived HttpOnly cookie and cleaning the URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(article)),
    );
    const response = await run();
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `/preview/${article.id}/article`,
    );
    expect(response.headers.get("Set-Cookie")).toBe(
      `kernel_blog_preview_${article.id}=${token}; HttpOnly; SameSite=Lax; Path=/preview/${article.id}/article; Max-Age=300; Secure`,
    );
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await response.text()).not.toContain(token);
  });
  it("allows synthetic HTTP preview cookies without inventing a production secure origin", async () => {
    vi.stubEnv("WEBSITE_URL", "");
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(article)),
    );
    expect(
      (
        await run(`http://127.0.0.1:3010/preview/${article.id}?token=${token}`)
      ).headers.get("Set-Cookie"),
    ).not.toContain("; Secure");
  });
  it.each([
    ["https://website.example.test/preview/48629173", "48629173"],
    [
      "https://website.example.test/preview/48629173?token=bad%3Bcookie",
      "48629173",
    ],
    [`https://website.example.test/preview/invalid?token=${token}`, "invalid"],
  ])("does not accept a malformed handoff %s", async (url, id) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await run(url, id)).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 500])(
    "rejects a denied or unavailable preview %s without a cookie",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(undefined, { status })),
      );
      const response = await run();
      expect(response.status).toBe(status === 500 ? 503 : status);
      expect(response.headers.get("Set-Cookie")).toBeNull();
    },
  );
  it("preserves private failure behavior for malformed responses or transport failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("private network detail");
      }),
    );
    expect((await run()).status).toBe(503);
  });
});
