import { afterEach, describe, expect, it, vi } from "vitest";

import { captureApiRequests } from "@/test/api-requests";

import {
  changePassword,
  requestEmailCode,
  updateProfile,
  updateUsername,
  verifyEmail,
} from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("account HTTP operations", () => {
  it("uses the API's profile, username, email and password vocabulary without moving values into URLs", async () => {
    const requests = captureApiRequests();
    const password = "  synthetic /?& password  ";
    const profile = { first_name: " Ada ", last_name: "Lovelace" };
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
});
