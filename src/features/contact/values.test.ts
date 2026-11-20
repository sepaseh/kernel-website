import { describe, expect, it } from "vitest";

import { invalidContactFields, normalizedContact } from "./values";

describe("contact-only Iranian mobile and text rules", () => {
  it.each(["09123456789", "+989123456789", "۰۹۱۲۳۴۵۶۷۸۹", "+٩٨٩١٢٣٤٥٦٧٨٩"])(
    "compares %s as the same logical submission while preserving inner description lines",
    (mobile) => {
      const value = normalizedContact({
        name: " Ada ",
        mobile: ` ${mobile} `,
        description: " First\nSecond ",
      });
      expect(value).toEqual({
        name: "Ada",
        mobile: "+989123456789",
        description: "First\nSecond",
      });
      expect(invalidContactFields(value)).toEqual({
        name: false,
        mobile: false,
        description: false,
      });
    },
  );
  it.each([
    "",
    "00989123456789",
    "0912-3456789",
    "0912 3456789",
    "+98912345678",
    "091234567890",
  ])("rejects %s without broadening auth normalization", (mobile) =>
    expect(
      invalidContactFields(
        normalizedContact({ name: "a", mobile, description: "b" }),
      ).mobile,
    ).toBe(true),
  );
  it("enforces trimmed UTF-16 limits", () => {
    expect(
      invalidContactFields(
        normalizedContact({ name: " ", mobile: "09", description: "\n" }),
      ),
    ).toEqual({ name: true, mobile: true, description: true });
    expect(
      invalidContactFields({
        name: "a".repeat(120),
        mobile: "+989123456789",
        description: "b".repeat(5000),
      }),
    ).toEqual({ name: false, mobile: false, description: false });
    expect(
      invalidContactFields({
        name: "😀".repeat(61),
        mobile: "+989123456789",
        description: "b".repeat(5001),
      }),
    ).toEqual({ name: true, mobile: false, description: true });
  });
});
