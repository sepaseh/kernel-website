import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { localeCodes } from "@/i18n/catalog-data/locales";

import { catalogs } from "./catalogs";

describe("website ICU catalogs", () => {
  it.each(localeCodes)(
    "loads only the %s resource when its loader is called",
    async (locale) => {
      const loaded: string[] = [];
      vi.resetModules();
      try {
        for (const code of localeCodes)
          vi.doMock(`@/i18n/catalog-data/locales/${code}.json`, () => {
            loaded.push(code);
            return { default: { account: `Synthetic ${code}` } };
          });
        const { catalogs: lazyCatalogs } = await import("./catalogs");
        expect(loaded).toEqual([]);
        const selected = await lazyCatalogs[locale]();
        expect(selected.default.account).toBe(`Synthetic ${locale}`);
        expect(loaded).toEqual([locale]);
      } finally {
        for (const code of localeCodes)
          vi.doUnmock(`@/i18n/catalog-data/locales/${code}.json`);
        vi.resetModules();
      }
    },
  );

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
