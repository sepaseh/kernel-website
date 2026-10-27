import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardApiRequest } from "./proxy";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("website API boundary", () => {
  it("never shares account responses between cookie sessions, even when upstream advertises a public cache", async () => {
    const fetch = vi.fn().mockImplementation(async (_url, init) =>
      Response.json(
        { session: init.headers.get("cookie") },
        {
          headers: { "Cache-Control": "public, max-age=3600" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    for (const cookie of ["session=alice", "session=bob"]) {
      const response = await forwardApiRequest(
        new Request("http://localhost:3001/api/account/me", {
          headers: { Cookie: cookie },
        }),
        ["account", "me"],
      );
      expect(await response.json()).toEqual({ session: cookie });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls)
      expect(init.cache).toBe("no-store");
  });
  it("marks guard failures and upstream errors private and non-cacheable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "expired" }, { status: 401 }),
        ),
    );
    const responses = [
      await forwardApiRequest(new Request("http://localhost:3001/api/users"), [
        "users",
      ]),
      await forwardApiRequest(
        new Request("http://localhost:3001/api/account/me"),
        ["account", "me"],
      ),
      await forwardApiRequest(
        new Request("http://localhost:3001/api/auth/login", { method: "POST" }),
        ["auth", "login"],
      ),
    ];
    expect(responses.map((response) => response.status)).toEqual([
      404, 401, 403,
    ]);
    for (const response of responses)
      expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects non-website routes and cross-origin mutations before contacting the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await forwardApiRequest(
          new Request("http://localhost:3001/api/users"),
          ["users"],
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await forwardApiRequest(
          new Request("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { Origin: "https://other.example" },
          }),
          ["auth", "login"],
        )
      ).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards cookie sessions and exact JSON to the API, with multiple response cookies and no caching", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Request-Id": "request-id",
    });
    headers.append("Set-Cookie", "session=value; HttpOnly; Path=/");
    headers.append("Set-Cookie", "session_data=other; HttpOnly; Path=/");
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { headers }));
    vi.stubGlobal("fetch", fetch);
    const payload = { identifier: "09123456789", password: "test-password" };
    const response = await forwardApiRequest(
      new Request("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3001",
          Cookie: "existing=value",
          "Content-Type": "application/json",
          "Accept-Language": "fa",
          Authorization: "Bearer untrusted",
        },
        body: JSON.stringify(payload),
      }),
      ["auth", "login"],
    );
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:3100/auth/login");
    expect(JSON.parse(new TextDecoder().decode(init.body))).toEqual(payload);
    expect(init.headers.get("cookie")).toBe("existing=value");
    expect(init.headers.has("accept-language")).toBe(false);
    expect(init.headers.get("origin")).toBe("http://localhost:3001");
    expect(init.headers.has("authorization")).toBe(false);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe("request-id");
  });
  it("bounds mutation bodies before forwarding and hides transport details on failure", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error("sensitive upstream connection details"));
    vi.stubGlobal("fetch", fetch);
    const headers = {
      Origin: "http://localhost:3001",
      "Content-Type": "application/json",
    };
    const oversized = await forwardApiRequest(
      new Request("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers,
        body: "x".repeat(33 * 1024),
      }),
      ["auth", "login"],
    );
    expect(oversized.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
    const failed = await forwardApiRequest(
      new Request("http://localhost:3001/api/account/me"),
      ["account", "me"],
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("sensitive");
  });
  it("ignores visitor Accept-Language on reads so the API uses persisted settings", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    await forwardApiRequest(
      new Request("http://localhost:3001/api/account/me", {
        headers: { "Accept-Language": "fa,ar;q=0.9,en;q=0.8" },
      }),
      ["account", "me"],
    );
    expect(fetch.mock.calls[0][1].headers.has("accept-language")).toBe(false);
  });
  it("rejects an invalid server-side API origin without contacting an upstream", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("API_BASE_URL", "invalid-url");
    expect(
      (
        await forwardApiRequest(
          new Request("http://localhost:3001/api/account/me"),
          ["account", "me"],
        )
      ).status,
    ).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the actual browser Host when Next's internal URL uses its listen hostname", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const request = new Request("http://localhost:3101/api/auth/otp-request", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3101",
        Origin: "http://127.0.0.1:3101",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobile: "09123456789", purpose: "register" }),
    });
    expect(
      (await forwardApiRequest(request, ["auth", "otp-request"])).status,
    ).toBe(200);
    expect(fetch.mock.calls[0][1].headers.get("origin")).toBe(
      "http://127.0.0.1:3101",
    );
  });
  it("removes bearer credentials from successful auth JSON while retaining status and every cookie", async () => {
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", "session=value; HttpOnly; Path=/");
    headers.append("Set-Cookie", "session_data=other; HttpOnly; Path=/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            access_token: "private-access",
            token: "private-token",
            nested: { refresh_token: "private-refresh", result: "ok" },
          },
          { status: 201, headers },
        ),
      ),
    );
    const response = await forwardApiRequest(
      new Request("http://localhost:3001/api/auth/register", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3001",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      ["auth", "register"],
    );
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(await response.json()).toEqual({ nested: { result: "ok" } });
  });
  it("preserves OTP cooldown payloads and API error bodies and statuses", async () => {
    const cooldown = { expires_in: 120, remaining_seconds: 120 };
    const failure = {
      message: "The code is invalid.",
      cause: { field: "otp" },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(cooldown))
        .mockResolvedValueOnce(Response.json(failure, { status: 400 })),
    );
    const request = () =>
      new Request("http://localhost:3001/api/auth/otp-request", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3001",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    const success = await forwardApiRequest(request(), ["auth", "otp-request"]);
    expect(await success.json()).toEqual(cooldown);
    const rejected = await forwardApiRequest(request(), [
      "auth",
      "otp-request",
    ]);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual(failure);
  });
});

const mutation = (headers: Record<string, string> = {}, body?: BodyInit) =>
  new Request("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3001",
      "Content-Type": "application/json",
      ...headers,
    },
    body,
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  });

describe("API forwarding failure boundaries", () => {
  it.each(["HEAD", "PUT", "DELETE", "OPTIONS"])(
    "rejects unsupported %s without fetching",
    async (method) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await forwardApiRequest(
        new Request("http://localhost:3001/api/account/me", { method }),
        ["account", "me"],
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "",
    "null",
    "invalid",
    "http://localhost:3001/",
    "https://localhost:3001",
    "http://other.example",
    "http://user@localhost:3001",
  ])(
    "rejects non-exact mutation Origin %j despite forwarded-host claims",
    async (Origin) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await forwardApiRequest(
        mutation({
          Origin,
          "x-forwarded-host": "other.example",
          forwarded: "host=other.example",
        }),
        ["auth", "login"],
      );
      expect(response.status).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "text/plain",
    "application/jsonp",
    "application/json-patch+json",
    "",
  ])("rejects unsupported media type %j", async (type) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await forwardApiRequest(
      mutation({ "Content-Type": type }, "{}"),
      ["auth", "login"],
    );
    expect(response.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards an absent JSON body and accepts JSON charset parameters", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await forwardApiRequest(
          mutation({ "Content-Type": "Application/JSON; charset=utf-8" }),
          ["auth", "login"],
        )
      ).status,
    ).toBe(200);
    expect(fetch.mock.calls[0][1].body.byteLength).toBe(0);
    expect(fetch.mock.calls[0][1].redirect).toBe("manual");
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts exactly 32 KiB in multiple chunks and releases the request stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024));
        controller.enqueue(new Uint8Array(16 * 1024));
        controller.close();
      },
    });
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const response = await forwardApiRequest(mutation({}, stream), [
      "auth",
      "login",
    ]);
    expect(response.status).toBe(200);
    expect(fetch.mock.calls[0][1].body.byteLength).toBe(32 * 1024);
    expect(stream.locked).toBe(false);
  });

  it("cancels an oversized streaming body and releases its lock", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32 * 1024 + 1));
      },
      cancel,
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await forwardApiRequest(mutation({}, stream), [
      "auth",
      "login",
    ]);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["read", "cancel"])(
    "hides %s stream errors, releases the reader and never contacts the API",
    async (failure) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          if (failure === "read")
            controller.error(new Error("sensitive stream details"));
          else controller.enqueue(new Uint8Array(32 * 1024 + 1));
        },
        cancel() {
          throw new Error("sensitive cancellation details");
        },
      });
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await forwardApiRequest(mutation({}, stream), [
        "auth",
        "login",
      ]);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).not.toContain("sensitive");
      expect(stream.locked).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("propagates request abort to the upstream signal without exposing rejection details", async () => {
    const controller = new AbortController();
    controller.abort(new Error("sensitive abort reason"));
    const fetch = vi.fn().mockImplementation(async (_url, init) => {
      init.signal.throwIfAborted();
    });
    vi.stubGlobal("fetch", fetch);
    const response = await forwardApiRequest(
      new Request("http://localhost:3001/api/account/me", {
        signal: controller.signal,
      }),
      ["account", "me"],
    );
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });

  it.each([204, 205])(
    "preserves a bodyless auth success with status %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(null, {
            status,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": "session=; Max-Age=0; HttpOnly",
            },
          }),
        ),
      );
      const response = await forwardApiRequest(mutation({}, "{}"), [
        "auth",
        "logout",
      ]);
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
      expect(response.headers.getSetCookie()).toHaveLength(1);
    },
  );

  it("retains cooldown headers while refusing upstream redirects and arbitrary headers", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: "https://untrusted.example",
          "Retry-After": "120",
          "Access-Control-Allow-Origin": "*",
          "X-Upstream-Private": "secret",
          "Set-Cookie": "session=value; HttpOnly",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await forwardApiRequest(
      new Request("http://localhost:3001/api/account/me"),
      ["account", "me"],
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.getSetCookie()).toHaveLength(1);
    for (const name of [
      "location",
      "access-control-allow-origin",
      "x-upstream-private",
    ])
      expect(response.headers.has(name)).toBe(false);
    expect(fetch.mock.calls[0][1].redirect).toBe("manual");
  });

  it("redacts every credential spelling throughout nested arrays while preserving ordinary values", async () => {
    const payload = {
      accessToken: "one",
      refreshToken: "two",
      list: [
        {
          token: "three",
          access_token: "four",
          refresh_token: "five",
          value: null,
        },
        7,
        false,
        "ok",
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    const response = await forwardApiRequest(mutation({}, "{}"), [
      "auth",
      "login",
    ]);
    expect(await response.json()).toEqual({
      list: [{ value: null }, 7, false, "ok"],
    });
  });

  it("does not expose malformed auth JSON or private upstream diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("private non-json diagnostics", {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const response = await forwardApiRequest(mutation({}, "{}"), [
      "auth",
      "login",
    ]);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });
});
