import { afterEach, describe, expect, it, vi } from "vitest";

import { localeCodes } from "@/i18n/catalog-data/locales";

import { getApiBaseUrl } from "../api/origin";
import type { PublicSettingsResponse } from "./contracts";
import { loadWebsiteLanguage, WebsiteSettingsError } from "./language";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const settings = (
  code: string,
  direction: "ltr" | "rtl",
): PublicSettingsResponse => ({
  language: {
    code,
    direction,
    calendar: code === "fa" ? "jalali" : "gregorian",
    name: code,
    native_name: code,
  },
  dark_theme: {},
  light_theme: {},
});

describe("administrator-configured website language", () => {
  it("reads changed persisted settings on the next independent request", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(settings("en", "ltr")))
      .mockResolvedValueOnce(Response.json(settings("fa", "rtl")));
    vi.stubGlobal("fetch", fetch);
    expect(await loadWebsiteLanguage()).toEqual({
      code: "en",
      direction: "ltr",
    });
    expect(await loadWebsiteLanguage()).toEqual({
      code: "fa",
      direction: "rtl",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls)
      expect(init.cache).toBe("no-store");
  });
  it.each(
    localeCodes.flatMap((code) =>
      (["ltr", "rtl"] as const).map((direction) => [code, direction] as const),
    ),
  )(
    "uses API language %s and direction %s without local overrides or visitor preferences",
    async (code, direction) => {
      vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
      const fetch = vi
        .fn()
        .mockResolvedValue(Response.json(settings(code, direction)));
      vi.stubGlobal("fetch", fetch);

      expect(await loadWebsiteLanguage()).toEqual({ code, direction });
      const [url, init] = fetch.mock.calls[0];
      expect(String(url)).toBe("http://127.0.0.1:3100/settings");
      expect(init.cache).toBe("no-store");
      expect(init.redirect).toBe("error");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(init.headers);
      expect(headers.get("accept")).toBe("application/json");
      expect(headers.has("accept-language")).toBe(false);
      expect(headers.has("cookie")).toBe(false);
      expect(headers.has("authorization")).toBe(false);
    },
  );

  it("rejects an unsupported persisted language instead of silently choosing English", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(settings("zz", "ltr"))),
    );
    await expect(loadWebsiteLanguage()).rejects.toMatchObject({
      reason: "unsupported-language",
      message: expect.stringContaining("no website translation catalog"),
    });
  });

  it.each([
    null,
    false,
    "invalid",
    {},
    { language: null },
    { language: {} },
    { language: { code: 5 } },
    { language: { code: "" } },
    { language: { code: "en" } },
    { language: { code: "en", direction: "auto" } },
    { language: { code: "fa", direction: "RTL" } },
    { language: { code: "ar", direction: "" } },
    { language: { code: "de", direction: null } },
    { language: { code: "en", direction: 1 } },
  ])("rejects malformed settings: %j", async (value) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
    await expect(loadWebsiteLanguage()).rejects.toMatchObject({
      reason: "invalid-settings",
    });
  });

  it("reports unavailability for transport failure, non-OK responses and invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("private upstream details"))
        .mockResolvedValueOnce(Response.json({}, { status: 503 }))
        .mockResolvedValueOnce(new Response("not-json")),
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(loadWebsiteLanguage()).rejects.toMatchObject({
        reason: "unavailable",
        message: "The application settings are temporarily unavailable.",
      });
    }
  });

  it("rejects an invalid API origin before any HTTP read", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("API_BASE_URL", "http://user:password@localhost:3000/private");
    await expect(loadWebsiteLanguage()).rejects.toBeInstanceOf(
      WebsiteSettingsError,
    );
    await expect(loadWebsiteLanguage()).rejects.toMatchObject({
      reason: "invalid-api-origin",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("API connection origin", () => {
  it("uses the documented local default only when no API origin is configured", () => {
    vi.stubEnv("API_BASE_URL", undefined);
    expect(getApiBaseUrl().href).toBe("http://localhost:3000/");
  });
  it.each([
    "not a URL",
    "ftp://localhost",
    "http://user@localhost",
    "http://localhost/path",
    "http://localhost?query=1",
    "http://localhost#fragment",
  ])("rejects an unsafe API origin before it can be used: %s", (origin) => {
    vi.stubEnv("API_BASE_URL", origin);
    expect(() => getApiBaseUrl()).toThrow();
  });
});
