import { describe, expect, it } from "vitest";

import {
  createWebsiteCsp,
  isCspDocumentPath,
  isCspNonce,
  readWebsiteCspMode,
} from "./csp";

describe("document CSP policy helpers", () => {
  it("defaults to report-only and rejects unknown rollout configuration", () => {
    expect(readWebsiteCspMode(undefined)).toBe("report-only");
    expect(readWebsiteCspMode("report-only")).toBe("report-only");
    expect(readWebsiteCspMode("enforce")).toBe("enforce");
    for (const value of ["", "off", "enforced", "ENFORCE"])
      expect(() => readWebsiteCspMode(value)).toThrow("WEBSITE_CSP_MODE");
  });

  it("accepts only the exact nonce alphabet and length", () => {
    expect(isCspNonce("aB0+/".repeat(4) + "aB0+")).toBe(true);
    for (const value of [
      null,
      "",
      "A".repeat(23),
      "A".repeat(25),
      "A".repeat(23) + "=",
      "A".repeat(24) + "\r\n",
      ...["\n", "\r", "\u2028", "\u2029"].map(
        (control) => "A".repeat(24) + control,
      ),
    ])
      expect(isCspNonce(value)).toBe(false);
  });

  it("restricts scripts and styles to the supplied nonce, with deliberate development exceptions", () => {
    const nonce = "A".repeat(24);
    const policy = createWebsiteCsp(nonce);
    expect(policy.split("; ")).toEqual([
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "script-src-attr 'none'",
      `style-src 'self' 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
    ]);
    expect(policy).not.toMatch(/unsafe-eval|report-uri|report-to|https:/);
    expect(createWebsiteCsp(nonce, true)).toContain("'unsafe-eval'");
    expect(createWebsiteCsp(nonce, true)).toContain(
      "connect-src 'self' ws: wss:",
    );
    for (const value of ["", "x' unsafe-inline", "A".repeat(24) + "\n"])
      expect(() => createWebsiteCsp(value)).toThrow(
        "Invalid website CSP nonce",
      );
  });

  it.each([
    "/",
    "/login",
    "/account",
    "/missing-page",
    "/apiary",
    "/fonts-page",
    "/_next/staticity",
  ])("includes document pathname %s", (pathname) => {
    expect(isCspDocumentPath(pathname)).toBe(true);
  });

  it.each([
    "/api",
    "/api/account/me",
    "/fonts/a.woff2",
    "/_next/static/a.js",
    "/_next/image",
    "/favicon.ico",
    "/icon.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/social-image",
    "/opengraph-image",
    "/opengraph-image/a",
  ])("excludes asset or API pathname %s", (pathname) => {
    expect(isCspDocumentPath(pathname)).toBe(false);
  });
});
