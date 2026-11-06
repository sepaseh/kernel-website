import { type NextRequest, NextResponse } from "next/server";

import {
  createWebsiteCsp,
  isCspDocumentPath,
  readWebsiteCspMode,
} from "@/shared/security/csp";
import { readSeoConfig } from "@/shared/seo/config";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const headers = new Headers(request.headers);
  headers.delete("x-kernel-csp-nonce");
  headers.delete("Content-Security-Policy");
  headers.delete("Content-Security-Policy-Report-Only");
  let response: NextResponse;
  if (isCspDocumentPath(path)) {
    const mode = readWebsiteCspMode(process.env.WEBSITE_CSP_MODE);
    const nonce = Buffer.from(
      crypto.getRandomValues(new Uint8Array(18)),
    ).toString("base64");
    const policy = createWebsiteCsp(
      nonce,
      process.env.NODE_ENV === "development",
    );
    // Replace caller values. Next reads this internal header to nonce its own
    // bootstrap scripts even while the response is in report-only rollout.
    headers.set("x-kernel-csp-nonce", nonce);
    headers.set("Content-Security-Policy", policy);
    response = NextResponse.next({ request: { headers } });
    response.headers.set(
      mode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
      policy,
    );
    // Preserve framework caching for real assets. Its missing-resource HTML
    // fallback already uses private/no-store caching and now gets a trusted CSP.
    if (!/^\/(?:fonts|_next)(?:\/|$)/.test(path))
      response.headers.set("Cache-Control", "private, no-store");
  } else {
    response = NextResponse.next({ request: { headers } });
  }
  // Preserve the existing runtime indexing policy for documents AND metadata/
  // API responses; CSP also covers resource paths that can fall back to HTML.
  const utility = [
    "/api",
    "/login",
    "/register",
    "/forgot-password",
    "/account",
  ].some((route) => path === route || path.startsWith(`${route}/`));
  if (utility || !readSeoConfig().indexable)
    response.headers.set(
      "X-Robots-Tag",
      utility ? "noindex, nofollow" : "noindex, follow",
    );
  return response;
}

export const config = {
  matcher: ["/(.*)"],
};
