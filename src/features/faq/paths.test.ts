import { describe, expect, it } from "vitest";

import { faqPath, parseFaqPage } from "./paths";

describe("FAQ pagination paths", () => {
  it("keeps the first page canonical and accepts the provider's last valid offset", () => {
    expect(parseFaqPage()).toBe(1);
    expect(parseFaqPage(["page", "1"])).toBe(1);
    expect(parseFaqPage(["page", "500001"])).toBe(500001);
    expect(faqPath()).toBe("/faq");
    expect(faqPath(2)).toBe("/faq/page/2");
  });
  it.for([
    ["page"],
    ["page", "0"],
    ["page", "01"],
    ["page", "-1"],
    ["page", "1.5"],
    ["page", "2", "extra"],
    ["search", "2"],
    ["page", "500002"],
    ["page", "999999999999999999999999999"],
    ["page", "1e2"],
  ])("rejects an invalid route %#", (path) => {
    expect(parseFaqPage(path)).toBeUndefined();
  });
});
