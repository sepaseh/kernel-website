import { afterEach, describe, expect, it, vi } from "vitest";

import { captureApiRequests } from "@/test/api-requests";

import { requestRecoveryCode, resetPassword } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("recovery HTTP operations", () => {
  it("posts the exact reset payload and requests the password-recovery OTP purpose", async () => {
    const requests = captureApiRequests();
    const password = "  synthetic /?& password  ";
    const mobile = "+989120000000";
    await resetPassword({ mobile, otp: "123456", password }, "fa");
    await requestRecoveryCode(mobile, "fa");
    expect(requests).toEqual([
      {
        path: "/api/auth/forgot-password",
        method: "POST",
        value: { mobile, otp: "123456", password },
        locale: "fa",
      },
      {
        path: "/api/auth/otp-request",
        method: "POST",
        value: { mobile, purpose: "forgot_password" },
        locale: "fa",
      },
    ]);
  });

  it("preserves the original OTP request failure", async () => {
    const failure = new DOMException("Synthetic cancellation", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetch);
    await expect(requestRecoveryCode("synthetic-mobile", "en")).rejects.toBe(
      failure,
    );
  });
});
