import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changePassword,
  getAccount,
  requestEmailCode,
  updateProfile,
  updateUsername,
  verifyEmail,
} from "./account/api.ts";
import { logout } from "./auth/api.ts";
import { login } from "./login/api.ts";
import { requestRecoveryCode, resetPassword } from "./recovery/api.ts";
import { register, requestRegistrationCode } from "./register/api.ts";

afterEach(() => vi.unstubAllGlobals());

describe("feature-owned website HTTP operations", () => {
  it("emits the API's actual route/method/body vocabulary without moving values into URLs", async () => {
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
    const password = "  synthetic /?& password  ";
    const mobile = "+989120000000";
    const profile = { first_name: " Ada ", last_name: "Lovelace" };
    await getAccount("fa");
    await login({ identifier: mobile, password }, "fa");
    await logout("fa");
    await register({ ...profile, mobile, otp: "123456", password }, "fa");
    await requestRegistrationCode(mobile, "fa");
    await resetPassword({ mobile, otp: "123456", password }, "fa");
    await requestRecoveryCode(mobile, "fa");
    await updateProfile(profile, "fa");
    await updateUsername({ username: "ada.user" }, "fa");
    await requestEmailCode({ email: "qa+synthetic@example.test" }, "fa");
    await verifyEmail(
      { email: "qa+synthetic@example.test", otp: "123456" },
      "fa",
    );
    await changePassword(
      { current_password: password, new_password: "  replacement  " },
      "fa",
    );
    expect(requests).toEqual([
      {
        path: "/api/account/me",
        method: "GET",
        value: undefined,
        locale: "fa",
      },
      {
        path: "/api/auth/login",
        method: "POST",
        value: { identifier: mobile, password },
        locale: "fa",
      },
      { path: "/api/auth/logout", method: "POST", value: {}, locale: "fa" },
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
      {
        path: "/api/account/update-profile",
        method: "PATCH",
        value: profile,
        locale: "fa",
      },
      {
        path: "/api/account/update-username",
        method: "POST",
        value: { username: "ada.user" },
        locale: "fa",
      },
      {
        path: "/api/account/request-email-verification",
        method: "POST",
        value: { email: "qa+synthetic@example.test" },
        locale: "fa",
      },
      {
        path: "/api/account/verify-email",
        method: "POST",
        value: { email: "qa+synthetic@example.test", otp: "123456" },
        locale: "fa",
      },
      {
        path: "/api/auth/change-password",
        method: "POST",
        value: { current_password: password, new_password: "  replacement  " },
        locale: "fa",
      },
    ]);
  });

  it("keeps account cancellation and OTP failures observable to their callers", async () => {
    const failure = new DOMException("Synthetic cancellation", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    await expect(getAccount("en", abort.signal)).rejects.toBe(failure);
    expect(fetch.mock.calls[0][1]?.signal).toBe(abort.signal);
    await expect(
      requestRegistrationCode("synthetic-mobile", "en"),
    ).rejects.toBe(failure);
    await expect(requestRecoveryCode("synthetic-mobile", "en")).rejects.toBe(
      failure,
    );
  });
});
