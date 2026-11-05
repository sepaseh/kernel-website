export type WebsiteCspMode = "report-only" | "enforce";

export function isCspDocumentPath(pathname: string): boolean {
  return !(
    /^\/(?:api|fonts|_next\/static|_next\/image)(?:\/|$)/.test(pathname) ||
    /^\/(?:favicon\.ico|icon\.svg|robots\.txt|sitemap\.xml|social-image)$/.test(
      pathname,
    ) ||
    /^\/opengraph-image(?:\/|$)/.test(pathname)
  );
}

export function readWebsiteCspMode(value: string | undefined): WebsiteCspMode {
  if (value === undefined || value === "report-only") return "report-only";
  if (value === "enforce") return "enforce";
  throw new Error("WEBSITE_CSP_MODE must be report-only or enforce.");
}

export function isCspNonce(value: string | null): value is string {
  return (
    value !== null && value.length === 24 && /^[A-Za-z0-9+/]{24}$/.test(value)
  );
}

export function createWebsiteCsp(nonce: string, development = false): string {
  if (!isCspNonce(nonce)) throw new Error("Invalid website CSP nonce.");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    // Motion/React SSR and the root error document use style attributes.
    // Style elements still require this document's nonce or a same-origin URL.
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ].join("; ");
}
