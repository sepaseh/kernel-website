import { type NextRequest, NextResponse } from "next/server";

import {
  createWebsiteCsp,
  isCspDocumentPath,
  readWebsiteCspMode,
} from "@/shared/security/csp";
import { readSeoConfig } from "@/shared/seo/config";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
    const headers = new Headers(request.headers);
    // Replace caller values. Next reads this internal header to nonce its own
    // bootstrap scripts even while the response is in report-only rollout.
    headers.set("x-kernel-csp-nonce", nonce);
    headers.set("Content-Security-Policy", policy);
    headers.delete("Content-Security-Policy-Report-Only");
    response = NextResponse.next({ request: { headers } });
    response.headers.set(
      mode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
      policy,
    );
    // A nonce belongs to one response; it must never enter a shared HTML cache.
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response = NextResponse.next();
  }
  // Preserve the existing runtime indexing policy for documents AND metadata/
  // API responses; CSP only owns document resources, not the entire proxy.
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
  matcher: [
    "/((?!_next/static(?:/|$)|_next/image(?:/|$)|fonts(?:/|$)|favicon[.]ico$|icon[.]svg$).*)",
  ],
};
