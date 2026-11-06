import { expect, type Page } from "@playwright/test";

/** Await registered local font faces and reject failed or entirely unloaded fonts. */
export const waitForVisualFonts = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const fonts = await page.evaluate(() =>
    [...document.fonts].map(({ family, status }) => ({ family, status })),
  );
  expect(
    fonts.length,
    "Self-hosted font faces must be registered",
  ).toBeGreaterThan(0);
  expect(fonts.filter(({ status }) => status === "error")).toEqual([]);
  expect(fonts.some(({ status }) => status === "loaded")).toBe(true);
};
