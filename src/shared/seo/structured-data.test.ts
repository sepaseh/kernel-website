import { describe, expect, it } from "vitest";

import { readSeoConfig } from "./config";
import { createWebsiteJsonLd, serializeJsonLd } from "./structured-data";

const description = {
  name: "Kernel",
  description: "یک نقطهٔ شروع روشن",
  language: "fa",
};

describe("website structured data", () => {
  it("emits only the factual WebSite entity with the configured root and language", () => {
    expect(
      createWebsiteJsonLd(
        description,
        readSeoConfig({ WEBSITE_URL: "https://kernel.example:443" }),
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://kernel.example/",
      url: "https://kernel.example/",
      name: description.name,
      description: description.description,
      inLanguage: "fa",
    });
  });

  it("omits the entity without a configured website origin", () => {
    expect(
      createWebsiteJsonLd(description, { indexable: false }),
    ).toBeUndefined();
  });

  it("escapes every less-than character so JSON-LD cannot close its HTML script", () => {
    const data = {
      ...description,
      name: '</script><script>alert("test")</script>',
      description: "<img src=x onerror=alert(1)> < another",
    };
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script>");
    expect(JSON.parse(serialized)).toEqual(data);
  });

  it("does not return an invalid script payload for non-JSON values", () => {
    expect(() => serializeJsonLd(undefined)).toThrow("JSON serializable");
  });
});
