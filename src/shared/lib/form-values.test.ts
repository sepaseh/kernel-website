import { describe, expect, it } from "vitest";

import { AuthPaths, profileNameMaxLength } from "../contracts";
import { SettingsPaths } from "../settings/contracts";
import {
  isMobile,
  mobileValue,
  normalizeDigits,
  passwordValue,
  textValue,
} from "./form-values";
describe("localized account input", () => {
  it("does not turn absent or file-valued fields into credentials", () => {
    const data = new FormData();
    expect(textValue(data, "missing")).toBe("");
    expect(passwordValue(data)).toBe("");
    data.set("password", new File(["private"], "synthetic.txt"));
    expect(textValue(data, "password")).toBe("");
    expect(passwordValue(data)).toBe("");
    data.set("current_password", "  preserve spaces  ");
    expect(passwordValue(data, "current_password")).toBe("  preserve spaces  ");
  });
  it("keeps the stable wire paths and profile length boundary", () => {
    expect(SettingsPaths.get).toBe("/settings");
    expect(AuthPaths).toEqual({
      login: "/auth/login",
      register: "/auth/register",
      otpRequest: "/auth/otp-request",
      logout: "/auth/logout",
      forgotPassword: "/auth/forgot-password",
    });
    expect(profileNameMaxLength).toBe(1000);
  });
  it("normalizes Persian and Arabic digits while preserving password whitespace", () => {
    const data = new FormData();
    data.set("mobile", " ۰۹۱۲-۳۴۵ ۶۷۸۹ ");
    data.set("password", "  secret password  ");
    data.set("first_name", "  Ada  ");
    expect(mobileValue(data)).toBe("09123456789");
    expect(isMobile(mobileValue(data))).toBe(true);
    expect(isMobile("123")).toBe(false);
    expect(passwordValue(data)).toBe("  secret password  ");
    expect(textValue(data, "first_name")).toBe("Ada");
    expect(normalizeDigits("١٢٣۴۵۶")).toBe("123456");
  });
});
