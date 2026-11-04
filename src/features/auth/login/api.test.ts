import { afterEach, describe, expect, it, vi } from "vitest";

import { captureApiRequests } from "@/test/api-requests";

import { login } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("login HTTP operation", () => {
  it("posts the exact identifier and password in the API body with its locale", async () => {
    const requests = captureApiRequests();
    const password = "  synthetic /?& password  ";
    const mobile = "+989120000000";
    await login({ identifier: mobile, password }, "fa");
    expect(requests).toEqual([
      {
        path: "/api/auth/login",
        method: "POST",
        value: { identifier: mobile, password },
        locale: "fa",
      },
    ]);
  });
});
