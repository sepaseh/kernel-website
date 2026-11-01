import { afterEach, describe, expect, it, vi } from "vitest";

import { captureApiRequests } from "@/test/api-requests";

import { getAccount, logout } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("session HTTP operations", () => {
  it("reads the current account and logs out using the API's route, method and locale", async () => {
    const requests = captureApiRequests();
    await getAccount("fa");
    await logout("fa");
    expect(requests).toEqual([
      {
        path: "/api/account/me",
        method: "GET",
        value: undefined,
        locale: "fa",
      },
      { path: "/api/auth/logout", method: "POST", value: {}, locale: "fa" },
    ]);
  });

  it("preserves the account read's cancellation failure and original signal", async () => {
    const failure = new DOMException("Synthetic cancellation", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    await expect(getAccount("en", abort.signal)).rejects.toBe(failure);
    expect(fetch.mock.calls[0][1]?.signal).toBe(abort.signal);
  });
});
