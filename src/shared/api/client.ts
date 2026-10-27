export class WebsiteApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T = void>(
  path: string,
  locale: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Accept-Language", locale);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const contents = await response.text();
    let value: unknown;
    try {
      value = JSON.parse(contents);
    } catch {
      // Malformed error JSON has no usable envelope; transport errors still escape.
    }
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const fields =
      body.cause && typeof body.cause === "object" && !Array.isArray(body.cause)
        ? Object.fromEntries(
            Object.entries(body.cause).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          )
        : {};
    if (
      response.status === 401 &&
      path !== "/account/me" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("kernel:session-expired"));
    throw new WebsiteApiError(
      typeof body.message === "string"
        ? body.message
        : "The request could not be completed.",
      response.status,
      fields,
      response.headers.get("x-request-id") ?? undefined,
    );
  }
  const contents = await response.text();
  return contents ? (JSON.parse(contents) as T) : (undefined as T);
}
