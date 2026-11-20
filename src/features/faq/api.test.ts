import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FaqApiError, loadFaqs } from "./api";

vi.mock("server-only", () => ({}));
const first = {
  id: "44444444-4444-4444-8444-000000000001",
  question: "A question?",
  answer: "A plain answer.\nSecond line.",
  sort: 0,
};
beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ items: [first], total: 1 })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("anonymous FAQ reader", () => {
  it("uses only bounded public pagination and omits visitor credentials", async () => {
    expect(await loadFaqs()).toEqual({ items: [first], total: 1 });
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3100/public/faqs?offset=0&size=20"),
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ items: [first], total: 21 }),
    );
    expect((await loadFaqs(1, 1)).total).toBe(21);
    expect(vi.mocked(fetch).mock.calls[1][0]).toEqual(
      new URL("http://127.0.0.1:3100/public/faqs?offset=0&size=1"),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ items: [], total: 21 }),
    );
    expect(await loadFaqs(3)).toEqual({ items: [], total: 21 });
  });
  it("accepts exact UTF-16/order boundaries and exposes only public fields", async () => {
    const value = {
      ...first,
      question: "😀".repeat(150),
      answer: "😀".repeat(2500),
      sort: 1_000_000,
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        items: [{ ...value, is_active: true, created_at: "ignored" }],
        total: 1,
      }),
    );
    expect((await loadFaqs()).items).toEqual([value]);
  });
  it.for([
    null,
    [],
    {},
    { items: [], total: -1 },
    { items: [], total: 1.1 },
    { items: [first], total: 0 },
    { items: [], total: 1 },
    { items: [first, first], total: 2 },
    ...[
      { id: "not-a-uuid" },
      { question: "" },
      { question: " padded " },
      { question: "a".repeat(301) },
      { answer: null },
      { answer: " " },
      { answer: "a".repeat(5001) },
      { sort: -1 },
      { sort: 1.5 },
      { sort: "0" },
      { sort: 1_000_001 },
    ].map((change) => ({ items: [{ ...first, ...change }], total: 1 })),
    {
      items: [
        { ...first, sort: 2 },
        { ...first, id: "44444444-4444-4444-8444-000000000002", sort: 1 },
      ],
      total: 2,
    },
    {
      items: [{ ...first, id: "44444444-4444-4444-8444-000000000002" }, first],
      total: 2,
    },
  ])("rejects malformed or inconsistent public data %#", async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(body));
    await expect(loadFaqs()).rejects.toBeInstanceOf(FaqApiError);
  });
  it.each([0, -1, 1.5, 500_002, Number.MAX_SAFE_INTEGER, NaN])(
    "rejects provider-invalid page %s before fetching",
    async (page) => {
      await expect(loadFaqs(page)).rejects.toBeInstanceOf(FaqApiError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("retains transport/body failures and never turns an outage into an empty list", async () => {
    const failure = new Error("Synthetic transport failure");
    vi.mocked(fetch).mockRejectedValueOnce(failure);
    await expect(loadFaqs()).rejects.toBe(failure);
    for (const response of [
      new Response(undefined, { status: 503 }),
      new Response(undefined, { status: 204 }),
    ]) {
      vi.mocked(fetch).mockResolvedValueOnce(response);
      await expect(loadFaqs()).rejects.toBeInstanceOf(FaqApiError);
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response("not JSON"));
    await expect(loadFaqs()).rejects.toBeInstanceOf(SyntaxError);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([0xff])),
    );
    await expect(loadFaqs()).rejects.toBeInstanceOf(TypeError);
  });
  it("cancels a response exceeding the bounded stream before parsing", async () => {
    const cancel = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
          },
          cancel,
        }),
      ),
    );
    await expect(loadFaqs()).rejects.toBeInstanceOf(FaqApiError);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
