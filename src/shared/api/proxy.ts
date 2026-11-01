import { getApiBaseUrl } from "./origin";

const allowed = new Map([
  ["auth/login", ["POST"]],
  ["auth/register", ["POST"]],
  ["auth/otp-request", ["POST"]],
  ["auth/forgot-password", ["POST"]],
  ["auth/logout", ["POST"]],
  ["auth/change-password", ["POST"]],
  ["account/me", ["GET"]],
  ["account/update-profile", ["PATCH"]],
  ["account/update-username", ["POST"]],
  ["account/request-email-verification", ["POST"]],
  ["account/verify-email", ["POST"]],
]);

const credentialFields = new Set([
  "access_token",
  "accessToken",
  "token",
  "refresh_token",
  "refreshToken",
]);
function withoutAuthCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAuthCredentials);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !credentialFields.has(key))
        .map(([key, item]) => [key, withoutAuthCredentials(item)]),
    );
  return value;
}

export async function forwardApiRequest(request: Request, segments: string[]) {
  let response: Response;
  try {
    response = await forward(request, segments);
  } catch {
    // Body-stream failures use the same safe response as transport failures.
    response = Response.json(
      { message: "The API is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  // Include local guard errors, upstream errors and successful cookie responses.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function forward(request: Request, segments: string[]) {
  const path = segments.join("/");
  if (!allowed.has(path))
    return Response.json({ message: "Not found." }, { status: 404 });
  if (!allowed.get(path)?.includes(request.method))
    return Response.json(
      { message: "Method not allowed." },
      { status: 405, headers: { Allow: allowed.get(path)!.join(", ") } },
    );
  if (request.method !== "GET" && !hasSameOrigin(request))
    return Response.json(
      { message: "The request origin is not allowed." },
      { status: 403 },
    );
  let base: URL;
  try {
    base = getApiBaseUrl();
  } catch {
    return Response.json(
      { message: "The API connection is not configured." },
      { status: 503 },
    );
  }
  const headers = new Headers({ Accept: "application/json" });
  for (const key of ["cookie", "content-type", "origin", "x-request-id"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  // The API resolves its persisted application language. Never forward browser
  // preferences or stale provider locales as an alternative language selector.
  const body =
    request.method === "GET" ? undefined : await readMutationBody(request);
  if (body instanceof Response) return body;
  const upstream = await fetch(new URL(`/${path}`, base), {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
  });
  return responseForBrowser(upstream, path);
}

function hasSameOrigin(request: Request): boolean {
  const incoming = new URL(request.url);
  // Next may construct request.url with its internal listen hostname. The browser's
  // target authority is the Host header; do not trust a client-supplied forwarded host.
  const targetHost =
    request.headers.get("host")?.toLowerCase() ?? incoming.host;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return (
      origin.origin === request.headers.get("origin") &&
      origin.protocol === incoming.protocol &&
      origin.host === targetHost
    );
  } catch {
    return false;
  }
}

async function readMutationBody(
  request: Request,
): Promise<ArrayBuffer | Response> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    return Response.json({ message: "Send a JSON request." }, { status: 415 });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        total += item.value.byteLength;
        if (total > 32 * 1024) {
          await reader.cancel();
          return Response.json(
            { message: "The request is too large." },
            { status: 413 },
          );
        }
        chunks.push(item.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return bytes.buffer;
}

async function responseForBrowser(
  upstream: Response,
  path: string,
): Promise<Response> {
  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store",
  });
  for (const key of ["content-type", "x-request-id", "retry-after"]) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  for (const value of upstream.headers.getSetCookie())
    responseHeaders.append("Set-Cookie", value);
  // The management API also supports bearer consumers. This website only uses
  // HttpOnly cookies; successful auth JSON must not expose those credentials.
  if (
    path.startsWith("auth/") &&
    upstream.ok &&
    upstream.status !== 204 &&
    upstream.status !== 205 &&
    upstream.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  ) {
    const payload: unknown = await upstream.json();
    return Response.json(withoutAuthCredentials(payload), {
      status: upstream.status,
      headers: responseHeaders,
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
