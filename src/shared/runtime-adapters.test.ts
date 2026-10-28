import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as apiRoute from "@/app/api/[...path]/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as socialImage } from "@/app/social-image/route";
import requestConfiguration from "@/i18n/request";
import { getRequestNonce } from "@/shared/security/nonce";
import { WebsiteSettingsError } from "@/shared/settings/language";
import { getWebsiteLanguage } from "@/shared/settings/server";

const framework = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  headers: new Headers(),
  image: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => framework.headers }));
vi.mock("next/server", () => ({ connection: framework.connection }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: (configure: unknown) => configure,
}));
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(
      element: unknown,
      options: { headers: HeadersInit; height: number; width: number },
    ) {
      super("Owned image adapter fixture", { headers: options.headers });
      framework.image(element, options);
    }
  },
}));

beforeEach(() => {
  framework.headers = new Headers();
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEBSITE_URL", "https://website.example.test");
  vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
});

afterEach(() => vi.unstubAllEnvs());

describe("server request adapters", () => {
  it.each([
    undefined,
    "",
    "attacker",
    "a".repeat(23),
    "a".repeat(25),
    "a".repeat(23) + "=",
  ])("does not invent or accept an invalid nonce %s", async (nonce) => {
    if (nonce !== undefined) framework.headers.set("x-kernel-csp-nonce", nonce);
    expect(await getRequestNonce()).toBeUndefined();
  });

  it("takes an exact validated nonce from this request's headers", async () => {
    framework.headers.set("x-kernel-csp-nonce", "aB9+".repeat(6));
    expect(await getRequestNonce()).toBe("aB9+".repeat(6));
  });

  it("reads uncached API language settings after the framework connection boundary", async () => {
    const fetch = vi.fn(async () => {
      expect(framework.connection).toHaveBeenCalled();
      return Response.json({ language: { code: "en", direction: "rtl" } });
    });
    vi.stubGlobal("fetch", fetch);
    expect(await getWebsiteLanguage()).toEqual({
      code: "en",
      direction: "rtl",
    });
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3100/settings"),
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("preserves a settings failure rather than rendering a guessed locale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 503 })),
    );
    await expect(getWebsiteLanguage()).rejects.toBeInstanceOf(
      WebsiteSettingsError,
    );
  });

  it("selects the full local catalog from API settings, ignoring the request locale hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ language: { code: "fa", direction: "ltr" } }),
      ),
    );
    const configuration = await requestConfiguration({
      requestLocale: Promise.resolve("de"),
    });
    const { default: persian } = await import("@/i18n/catalog-data/locales/fa");
    expect(configuration.locale).toBe("fa");
    expect(configuration.messages).toEqual(persian);
  });
});

describe("framework metadata routes", () => {
  it("publishes only the explicit public origin and no fabricated modification time", async () => {
    expect(await robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://website.example.test/sitemap.xml",
    });
    expect(await sitemap()).toEqual([{ url: "https://website.example.test/" }]);
    expect(framework.connection).toHaveBeenCalledTimes(2);
  });

  it("keeps previews crawlable for noindex discovery but omits sitemap publication", async () => {
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    expect(await robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    });
    expect(await sitemap()).toEqual([]);
  });

  it("does not invent an origin when none is configured", async () => {
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    vi.stubEnv("WEBSITE_URL", "");
    expect(await sitemap()).toEqual([]);
  });

  it("constructs a public fixed-dimension social image without depending on language or private settings", () => {
    const response = socialImage();
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    const [element, options] = framework.image.mock.calls[0];
    expect(element).toMatchObject({
      type: "div",
      props: { children: "Kernel" },
    });
    expect(options).toMatchObject({ width: 1200, height: 630 });
  });
});

describe("Next route to reviewed HTTP boundary", () => {
  it("awaits route parameters and preserves private cookie session responses", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        { id: "session-account" },
        { headers: { "Set-Cookie": "session=owned; HttpOnly; Path=/" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await apiRoute.GET(
      new Request("https://website.example.test/api/account/me", {
        headers: { Cookie: "session=owned" },
      }),
      { params: Promise.resolve({ path: ["account", "me"] }) },
    );
    expect(await response.json()).toEqual({ id: "session-account" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.getSetCookie()).toEqual([
      "session=owned; HttpOnly; Path=/",
    ]);
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3100/account/me"),
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("retains credential stripping for a cookie-authenticated login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { token: "must-not-cross", account: { id: "owned" } },
          { headers: { "Set-Cookie": "session=owned; HttpOnly; Path=/" } },
        ),
      ),
    );
    const response = await apiRoute.POST(
      new Request("https://website.example.test/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://website.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: "09120000000",
          password: " owned password ",
        }),
      }),
      { params: Promise.resolve({ path: ["auth", "login"] }) },
    );
    expect(await response.json()).toEqual({ account: { id: "owned" } });
    expect(response.headers.getSetCookie()).toEqual([
      "session=owned; HttpOnly; Path=/",
    ]);
  });

  it.each(["PUT", "DELETE"] as const)(
    "does not broaden the reviewed mutation allowlist through %s export",
    async (method) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await apiRoute[method](
        new Request("https://website.example.test/api/account/update-profile", {
          method,
        }),
        { params: Promise.resolve({ path: ["account", "update-profile"] }) },
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("PATCH");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("passes PATCH through the same origin/media-type guard", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await apiRoute.PATCH(
      new Request("https://website.example.test/api/account/update-profile", {
        method: "PATCH",
        headers: { Origin: "https://untrusted.example.test" },
      }),
      { params: Promise.resolve({ path: ["account", "update-profile"] }) },
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
