import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { localeCodes } from "@/i18n/catalog-data/locales";

import { catalogs } from "./catalogs";

describe("website ICU catalogs", () => {
  it.each(localeCodes)(
    "renders every message in %s without syntax or interpolation fallbacks",
    async (locale) => {
      const messages = (await catalogs[locale]()).default;
      const translate = createTranslator({
        locale,
        messages,
        onError(error) {
          throw error;
        },
      });
      const leaves = Object.entries(messages);
      expect(leaves.length).toBeGreaterThan(100);
      for (const [key, source] of leaves) {
        const rendered = translate(key as Parameters<typeof translate>[0], {
          name: "Ada",
          email: "qa@example.com",
          seconds: 17,
        });
        expect(rendered, `${locale}:${key}`).not.toBe("");
        expect(rendered, `${locale}:${key}`).not.toMatch(
          /\{(?:name|email|seconds)\}/,
        );
        if (source.includes("{name}")) expect(rendered).toContain("Ada");
        if (source.includes("{email}"))
          expect(rendered).toContain("qa@example.com");
        if (source.includes("{seconds}")) expect(rendered).toContain("17");
      }
    },
  );
});
