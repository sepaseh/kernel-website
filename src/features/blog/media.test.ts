import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/media/[fileId]/route";

vi.mock("server-only", () => ({}));
const id = "33333333-3333-4333-8333-333333333333";
const request = () =>
  new Request("https://website.example.test/media/" + id, {
    headers: {
      Cookie: "private=must-not-forward",
      Authorization: "Bearer private",
    },
  });
const run = (fileId = id) =>
  GET(request(), { params: Promise.resolve({ fileId }) });
describe("same-origin public media boundary", () => {
  it.each([
    { type: "image/png", bytes: [137, 80, 78, 71, 13, 10, 26, 10] },
    { type: "image/jpeg", bytes: [255, 216, 255, 0] },
  ])(
    "returns verified $type bytes without forwarding credentials or upstream headers",
    async ({ type, bytes }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(new Uint8Array(bytes), {
              headers: {
                "Content-Type": type,
                "Set-Cookie": "must-not-forward",
                Location: "https://attacker.test",
              },
            }),
        ),
      );
      const result = await run();
      expect(result.status).toBe(200);
      expect([...new Uint8Array(await result.arrayBuffer())]).toEqual(bytes);
      expect(result.headers.get("Content-Type")).toBe(type);
      expect(result.headers.get("Cache-Control")).toBe("private, no-store");
      expect(result.headers.get("Set-Cookie")).toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        new URL("http://127.0.0.1:3100/files/" + id + "/content"),
        expect.objectContaining({
          headers: { Accept: "image/jpeg, image/png" },
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
        }),
      );
    },
  );
  it("rejects invalid identifiers without touching storage", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await run("../private")).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([404, 401, 500])(
    "keeps an upstream %s response private",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(undefined, { status })),
      );
      expect((await run()).status).toBe(status === 404 ? 404 : 503);
    },
  );
  it.each([
    new Response("<svg onload='attack()'/>", {
      headers: { "Content-Type": "image/svg+xml" },
    }),
    new Response("<html>not a PNG</html>", {
      headers: { "Content-Type": "image/png" },
    }),
    new Response("not a JPEG", { headers: { "Content-Type": "image/jpeg" } }),
    new Response(null, { headers: { "Content-Type": "image/png" } }),
    new Response(new Uint8Array(20 * 1024 * 1024 + 1), {
      headers: { "Content-Type": "image/png" },
    }),
  ])("rejects malformed or oversized media %#", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const result = await run();
    expect(result.status).toBe(503);
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("handles canceled/failed upstream reads without returning their private diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("private network details");
      }),
    );
    const result = await run();
    expect(result.status).toBe(503);
    expect(await result.text()).toBe("");
  });
});
