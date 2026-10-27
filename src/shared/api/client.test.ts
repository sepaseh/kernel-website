import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthPaths } from "@/shared/contracts";

import { apiRequest, WebsiteApiError } from "./client.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const sessionObserver = () => {
  const browser = new EventTarget();
  const expired = vi.fn();
  browser.addEventListener("kernel:session-expired", expired);
  vi.stubGlobal("window", browser);
  return expired;
};

describe("cookie-only website HTTP client", () => {
  it("keeps requests local, uncached and cookie-based without mutating caller headers", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('{"saved":true}'));
    vi.stubGlobal("fetch", fetch);
    const headers = new Headers({
      "X-Request-Id": "synthetic-id",
      Accept: "text/plain",
    });
    const controller = new AbortController();
    const body = JSON.stringify({ password: "  synthetic password  " });
    const result = await apiRequest("/auth/login", "fa", {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      credentials: "omit",
      cache: "force-cache",
    });
    expect(result).toEqual({ saved: true });
    const [target, init] = fetch.mock.calls[0];
    expect(target).toBe("/api/auth/login");
    expect(init).toMatchObject({
      method: "POST",
      body,
      credentials: "include",
      cache: "no-store",
    });
    expect(init?.signal).toBe(controller.signal);
    expect(new Headers(init?.headers)).toEqual(
      new Headers({
        Accept: "application/json",
        "Accept-Language": "fa",
        "Content-Type": "application/json",
        "X-Request-Id": "synthetic-id",
      }),
    );
    expect(headers.get("Accept")).toBe("text/plain");
    expect(headers.has("Accept-Language")).toBe(false);
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("returns empty successful responses and rejects malformed successful JSON", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("broken JSON"));
    vi.stubGlobal("fetch", fetch);
    expect(await apiRequest("/account/me", "en")).toBeUndefined();
    expect(
      new Headers(fetch.mock.calls[0][1]?.headers).has("Content-Type"),
    ).toBe(false);
    await expect(apiRequest("/account/me", "en")).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });

  it("keeps localized errors, string field messages and the response request identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "ورودی معتبر نیست",
            cause: {
              mobile: "شماره معتبر نیست",
              nested: { secret: true },
              number: 42,
            },
          }),
          { status: 422, headers: { "x-request-id": "synthetic-response-id" } },
        ),
      ),
    );
    await expect(apiRequest("/auth/register", "fa")).rejects.toMatchObject({
      message: "ورودی معتبر نیست",
      status: 422,
      fields: { mobile: "شماره معتبر نیست" },
      requestId: "synthetic-response-id",
    });
  });

  it.each(["broken JSON", "[]", "42", "null", '"text"'])(
    "uses a safe fallback for an unusable error envelope: %s",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status: 503 })),
      );
      await expect(apiRequest("/account/me", "en")).rejects.toMatchObject({
        message: "The request could not be completed.",
        status: 503,
        fields: {},
        requestId: undefined,
      });
    },
  );

  it.each([
    AuthPaths.forgotPassword,
    AuthPaths.login,
    AuthPaths.otpRequest,
    AuthPaths.register,
  ])(
    "keeps rejected public credentials/codes local for %s without expiring a session",
    async (path) => {
      const expired = sessionObserver();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { message: "Public credentials rejected" },
              { status: 401 },
            ),
          ),
      );
      await expect(apiRequest(path, "en")).rejects.toMatchObject({
        message: "Public credentials rejected",
        status: 401,
      });
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it("notifies once per protected 401 while the anonymous session read stays silent", async () => {
    const expired = sessionObserver();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response('{"message":"Session expired","cause":[]}', {
            status: 401,
          }),
      ),
    );
    await expect(apiRequest("/account/me", "en")).rejects.toBeInstanceOf(
      WebsiteApiError,
    );
    expect(expired).not.toHaveBeenCalled();
    for (const path of [AuthPaths.logout, "/auth/change-password"]) {
      await expect(apiRequest(path, "en")).rejects.toBeInstanceOf(
        WebsiteApiError,
      );
    }
    expect(expired).toHaveBeenCalledTimes(2);
  });

  it.each([
    new DOMException("Synthetic cancellation", "AbortError"),
    new TypeError("Synthetic transport failure"),
  ])("preserves fetch rejection identity: %s", async (failure) => {
    const expired = sessionObserver();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(apiRequest("/auth/logout", "en")).rejects.toBe(failure);
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([401, 500])(
    "preserves cancellation after headers during a %i error body without expiring a session",
    async (status) => {
      const expired = sessionObserver();
      const abort = new AbortController();
      const failure = new DOMException(
        "Synthetic body cancellation",
        "AbortError",
      );
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          abort.signal.addEventListener(
            "abort",
            () => stream.error(abort.signal.reason),
            { once: true },
          );
        },
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status })),
      );
      const pending = apiRequest("/auth/logout", "fa", {
        signal: abort.signal,
      });
      await Promise.resolve();
      abort.abort(failure);
      await expect(pending).rejects.toBe(failure);
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it("preserves a real response-stream read failure instead of treating it as malformed JSON", async () => {
    const expired = sessionObserver();
    const failure = new TypeError("Synthetic response stream failure");
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.error(failure);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 401 })),
    );
    await expect(apiRequest("/auth/logout", "en")).rejects.toBe(failure);
    expect(expired).not.toHaveBeenCalled();
  });
});
