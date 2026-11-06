import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "./proxy";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEBSITE_URL", "https://website.example.test");
  vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
  vi.stubEnv("WEBSITE_CSP_MODE", "enforce");
});

afterEach(() => vi.unstubAllEnvs());

describe("document request security integration", () => {
  it.each([
    ["/_next/static/main.js", false],
    ["/_next/static-document", true],
    ["/_next/image", false],
    ["/fonts/vazirmatn-latin.woff2", false],
    ["/fonts-preview", true],
    ["/favicon.ico", false],
    ["/faviconXico", true],
    ["/icon.svg", false],
    ["/iconXsvg", true],
    ["/login", true],
    ["/api/account/me", true],
  ] as const)(
    "matches only the intended proxy path boundaries for %s",
    (pathname, matched) => {
      expect(new RegExp(`^${config.matcher[0]}$`).test(pathname)).toBe(matched);
    },
  );

  it("replaces caller CSP and nonce headers with one random document nonce", () => {
    const response = proxy(
      new NextRequest("https://website.example.test/", {
        headers: {
          "Content-Security-Policy": "default-src *",
          "Content-Security-Policy-Report-Only": "default-src *",
          "x-kernel-csp-nonce": "attacker",
        },
      }),
    );
    const nonce = response.headers.get(
      "x-middleware-request-x-kernel-csp-nonce",
    );
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{24}$/);
    const policy = response.headers.get("Content-Security-Policy");
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("attacker");
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(policy);
    expect(
      response.headers.get(
        "x-middleware-request-content-security-policy-report-only",
      ),
    ).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("uses report-only response rollout while the internal bootstrap policy stays enforced", () => {
    vi.stubEnv("WEBSITE_CSP_MODE", "report-only");
    const response = proxy(
      new NextRequest("https://website.example.test/missing"),
    );
    const policy = response.headers.get("Content-Security-Policy-Report-Only");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(policy);
  });

  it("permits development evaluation only in development and never indexes that document", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = proxy(new NextRequest("https://website.example.test/"));
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "'unsafe-eval'",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "ws: wss:",
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("creates a fresh nonce for every document and rejects invalid rollout configuration", () => {
    const first = proxy(new NextRequest("https://website.example.test/"));
    const second = proxy(new NextRequest("https://website.example.test/"));
    expect(
      first.headers.get("x-middleware-request-x-kernel-csp-nonce"),
    ).not.toBe(second.headers.get("x-middleware-request-x-kernel-csp-nonce"));
    vi.stubEnv("WEBSITE_CSP_MODE", "invalid");
    expect(() =>
      proxy(new NextRequest("https://website.example.test/")),
    ).toThrow("WEBSITE_CSP_MODE");
  });

  it.each([
    "/login",
    "/register",
    "/forgot-password",
    "/account",
    "/account/settings",
    "/api",
    "/api/account/me",
  ])("keeps utility route %s out of search", (path) => {
    const response = proxy(
      new NextRequest(`https://website.example.test${path}`),
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it.each([
    "/api/account/me",
    "/robots.txt",
    "/sitemap.xml",
    "/social-image",
    "/fonts/vazirmatn-latin.woff2",
    "/icon.svg",
    "/_next/static/test.js",
  ])("keeps document CSP off asset/API response %s", (path) => {
    const response = proxy(
      new NextRequest(`https://website.example.test${path}`),
    );
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(
      response.headers.get("Content-Security-Policy-Report-Only"),
    ).toBeNull();
    expect(
      response.headers.get("x-middleware-request-x-kernel-csp-nonce"),
    ).toBeNull();
  });

  it("applies preview indexing protection to metadata as well as documents", () => {
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    const response = proxy(
      new NextRequest("https://website.example.test/sitemap.xml"),
    );
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });
});
