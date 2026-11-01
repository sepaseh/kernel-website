import { vi } from "vitest";

export function captureApiRequests() {
  const requests: {
    path: string;
    method: string;
    value: unknown;
    locale: string | null;
  }[] = [];
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async (target, init) => {
        requests.push({
          path: String(target),
          method: init?.method ?? "GET",
          value: init?.body ? JSON.parse(String(init.body)) : undefined,
          locale: new Headers(init?.headers).get("Accept-Language"),
        });
        return new Response('{"expires_in":120,"remaining_seconds":60}');
      }),
  );
  return requests;
}
