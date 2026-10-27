import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { localeCodes } from "@/i18n/catalog-data/locales";

import budget from "../../../performance-budget.json";
import manifest from "./manifest.json";
import { websiteFontPreloads } from "./preloads";

describe("self-hosted alphabet font loading", () => {
  it.each(localeCodes)("preloads only the configured %s alphabet", (locale) => {
    const expected = ["/fonts/vazirmatn-latin.woff2"];
    if (locale === "fa" || locale === "ar")
      expected.push("/fonts/vazirmatn-arabic.woff2");
    expect(websiteFontPreloads(locale)).toEqual(expected);
    const bytes = Object.values(manifest.subsets)
      .filter(({ href }) => expected.includes(href))
      .reduce((sum, font) => sum + font.bytes, 0);
    expect(bytes).toBeLessThanOrEqual(budget.preloadedFontBytes);
  });

  it("ships every generated font intact, matching disjoint CSS assignments and its licensed source", async () => {
    const source = await readFile(
      new URL("../../../font-source/vazirmatn-variable.woff2", import.meta.url),
    );
    expect(source).toHaveLength(manifest.source.bytes);
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      manifest.source.sha256,
    );
    const license = await readFile(
      new URL("../../../public/fonts/OFL.txt", import.meta.url),
      "utf8",
    );
    expect(license).toContain("SIL OPEN FONT LICENSE");
    const css = await readFile(
      new URL("./vazirmatn.css", import.meta.url),
      "utf8",
    );
    const assigned = new Set<number>();
    for (const value of Object.values(manifest.subsets)) {
      const bytes = await readFile(
        new URL(`../../../public${value.href}`, import.meta.url),
      );
      expect(bytes).toHaveLength(value.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        value.sha256,
      );
      expect(css).toContain(`url("${value.href}")`);
      expect(css).toContain(`unicode-range: ${value.unicodeRange};`);
      let count = 0;
      for (const range of value.unicodeRange.split(", ")) {
        const [from, to = from] = range.slice(2).split("-");
        for (
          let point = parseInt(from, 16);
          point <= parseInt(to, 16);
          point++
        ) {
          expect(assigned.has(point)).toBe(false);
          assigned.add(point);
          count++;
        }
      }
      expect(count).toBe(value.codepointCount);
    }
    expect(assigned.size).toBe(manifest.source.codepointCount);
    expect(Object.keys(budget.fontSubsetBytes).sort()).toEqual(
      Object.keys(manifest.subsets).sort(),
    );
    for (const name of ["latin", "arabic", "extended"] as const)
      expect(manifest.subsets[name].bytes).toBeLessThanOrEqual(
        budget.fontSubsetBytes[name],
      );
  });
});
