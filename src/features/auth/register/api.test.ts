import { afterEach, describe, expect, it, vi } from "vitest";

import { captureApiRequests } from "@/test/api-requests";

import { register, requestRegistrationCode } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("registration HTTP operations", () => {
  it("posts the profile and exact password and requests the registration OTP purpose", async () => {
    const requests = captureApiRequests();
    const password = "  synthetic /?& password  ";
    const mobile = "+989120000000";
    const profile = { first_name: " Ada ", last_name: "Lovelace" };
    await register({ ...profile, mobile, otp: "123456", password }, "fa");
    await requestRegistrationCode(mobile, "fa");
    expect(requests).toEqual([
      {
        path: "/api/auth/register",
        method: "POST",
        value: { ...profile, mobile, otp: "123456", password },
        locale: "fa",
      },
      {
        path: "/api/auth/otp-request",
        method: "POST",
        value: { mobile, purpose: "register" },
        locale: "fa",
      },
    ]);
  });

  it("preserves the original OTP request failure", async () => {
    const failure = new DOMException("Synthetic cancellation", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetch);
    await expect(
      requestRegistrationCode("synthetic-mobile", "en"),
    ).rejects.toBe(failure);
  });
});
