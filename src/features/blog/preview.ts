import "server-only";

import { readSeoConfig } from "@/shared/seo/config";

import { BlogApiError, loadArticle } from "./api";
import { isPostCode, previewCookieName } from "./paths";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function exchangePreview(request: Request, id: string) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!isPostCode(id) || !token || !/^[A-Za-z\d_.-]{16,4000}$/.test(token))
    return new Response(undefined, { status: 404, headers: privateHeaders });
  try {
    await loadArticle(id, token);
  } catch (error) {
    return new Response(undefined, {
      status: error instanceof BlogApiError ? error.status : 503,
      headers: privateHeaders,
    });
  }
  const destination = new URL(`/preview/${id}/article`, url);
  const secure =
    url.protocol === "https:" || readSeoConfig().url?.protocol === "https:";
  const cookie = `${previewCookieName(id)}=${token}; HttpOnly; SameSite=Lax; Path=${destination.pathname}; Max-Age=300${secure ? "; Secure" : ""}`;
  return new Response(undefined, {
    status: 303,
    headers: {
      ...privateHeaders,
      Location: destination.pathname,
      "Set-Cookie": cookie,
    },
  });
}
