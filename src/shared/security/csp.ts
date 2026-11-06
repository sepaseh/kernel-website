export type WebsiteCspMode = "report-only" | "enforce";

/**
 * Classifies potentially HTML paths before filesystem routing. Missing assets
 * can render an HTML fallback, so only actual JSON and metadata handlers opt out.
 */
export function isCspDocumentPath(pathname: string): boolean {
  return !(
    /^\/api\/.+/.test(pathname) ||
    /^\/(?:icon\.svg|robots\.txt|sitemap\.xml|social-image)$/.test(pathname)
  );
}

/** Defaults an absent rollout setting to report-only and rejects invalid values. */
export function readWebsiteCspMode(value: string | undefined): WebsiteCspMode {
  if (value === undefined || value === "report-only") return "report-only";
  if (value === "enforce") return "enforce";
  throw new Error("WEBSITE_CSP_MODE must be report-only or enforce.");
}

/** Checks nonce syntax only; the caller must supply an unpredictable per-document value. */
export function isCspNonce(value: string | null): value is string {
  return (
    value !== null && value.length === 24 && /^[A-Za-z0-9+/]{24}$/.test(value)
  );
}

/**
 * Builds a pure policy with explicit development exceptions for eval and WebSockets.
 * The caller owns nonce generation and matching header/document application.
 */
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
