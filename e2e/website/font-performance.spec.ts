import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import english from "@/i18n/catalog-data/locales/en";
import persian from "@/i18n/catalog-data/locales/fa";

import { setSiteLanguage, websiteOrigin } from "./helpers";

const latinFont = "/fonts/vazirmatn-latin.woff2";
const arabicFont = "/fonts/vazirmatn-arabic.woff2";
const messagesByLocale = { en: english, fa: persian };
const originalFontPath = fileURLToPath(
  new URL("../../font-source/vazirmatn-variable.woff2", import.meta.url),
);

test("requests only the font subsets required by the persisted language", async ({
  browser,
  request,
}) => {
  try {
    for (const [locale, expectedFonts] of [
      ["en", [latinFont]],
      ["fa", [latinFont, arabicFont]],
      ["tr", [latinFont]],
    ] as const) {
      await setSiteLanguage(request, locale);
      // Each context has an empty cache, so another language's earlier font
      // request cannot hide a missing preload or unnecessary transferred file.
      const context = await browser.newContext({ reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        const requestedFonts = new Set<string>();
        const failedFonts: string[] = [];
        page.on("request", (resource) => {
          if (resource.resourceType() === "font")
            requestedFonts.add(new URL(resource.url()).pathname);
        });
        page.on("response", (response) => {
          if (response.request().resourceType() === "font" && !response.ok())
            failedFonts.push(`${response.status()} ${response.url()}`);
        });
        page.on("requestfailed", (resource) => {
          if (resource.resourceType() === "font")
            failedFonts.push(`Network failure: ${resource.url()}`);
        });
        await page.goto(websiteOrigin);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const preloads = await page
          .locator('head link[rel="preload"][as="font"]')
          .evaluateAll((links) =>
            links.map(
              (link) => new URL((link as HTMLLinkElement).href).pathname,
            ),
          );
        expect(preloads.sort(), `${locale} preload set`).toEqual(
          [...expectedFonts].sort(),
        );
        expect([...requestedFonts].sort(), `${locale} font requests`).toEqual(
          [...expectedFonts].sort(),
        );
        expect(failedFonts).toEqual([]);
        expect(
          await page.evaluate(() =>
            [...document.fonts]
              .filter((font) => font.status === "error")
              .map((font) => font.family),
          ),
        ).toEqual([]);
      } finally {
        await context.close();
      }
    }
  } finally {
    await setSiteLanguage(request, "en");
  }
});

test("keeps the localized hero readable without JavaScript after font subsetting", async ({
  browser,
  request,
}) => {
  try {
    for (const locale of ["en", "fa"] as const) {
      await setSiteLanguage(request, locale);
      const messages = messagesByLocale[locale];
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 360, height: 900 },
      });
      try {
        const page = await context.newPage();
        const response = await page.goto(websiteOrigin);
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const hero = page.getByRole("heading", { level: 1 });
        await expect(hero).toContainText(messages.homeTitle);
        await expect(hero).toBeVisible();
        await expect(
          page.getByText(messages.homeIntro, { exact: true }),
        ).toBeVisible();
        expect(
          await hero.evaluate((element) => {
            let opacity = 1;
            for (
              let current: Element | null = element;
              current;
              current = current.parentElement
            )
              opacity *= Number(getComputedStyle(current).opacity);
            return opacity;
          }),
        ).toBe(1);
        await expect(
          page
            .getByRole("main")
            .getByRole("link", { name: messages.register, exact: true })
            .first(),
        ).toHaveAttribute("href", "/register");
      } finally {
        await context.close();
      }
    }
  } finally {
    await setSiteLanguage(request, "en");
  }
});

test("retains translated theme controls and reduced-motion content in the server-rendered shell", async ({
  browser,
  request,
}) => {
  await setSiteLanguage(request, "fa");
  const messages = persian;
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(websiteOrigin);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const theme = page
      .getByRole("banner")
      .getByRole("button", { name: messages.siteTheme, exact: true });
    await theme.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("button", { name: messages.siteTheme, exact: true }),
    ).toBeVisible();
    const section = page.getByRole("heading", {
      name: messages.homeSectionTitle,
      exact: true,
    });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await expect
      .poll(() =>
        section.evaluate((element) => {
          const wrapper = element.closest("[style]");
          if (!wrapper) return 0;
          const transform = getComputedStyle(wrapper).transform;
          return transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m42;
        }),
      )
      .toBe(0);
  } finally {
    await context.close();
    await setSiteLanguage(request, "en");
  }
});

test("preserves default browser shaping widths across subset faces and variable weights", async ({
  browser,
  request,
}) => {
  await setSiteLanguage(request, "en");
  const context = await browser.newContext({ reducedMotion: "reduce" });
  // This URL is fulfilled by Playwright only; the original font remains outside
  // public/ and is never added to the application or its production assets.
  const baselineUrl = `${websiteOrigin}/__font-regression/original-vazirmatn.woff2`;
  await context.route(baselineUrl, (route) =>
    route.fulfill({
      path: originalFontPath,
      contentType: "font/woff2",
      headers: { "Cache-Control": "no-store" },
    }),
  );
  try {
    const page = await context.newPage();
    await page.goto(websiteOrigin);
    const measurements = await page.evaluate(async (fontUrl) => {
      const baselineFamily = "KernelOriginalVazirmatn";
      const baseline = new FontFace(baselineFamily, `url("${fontUrl}")`, {
        style: "normal",
        weight: "100 900",
      });
      await baseline.load();
      document.fonts.add(baseline);
      const candidateFamily = getComputedStyle(document.body).fontFamily;
      const holder = document.createElement("div");
      holder.style.cssText =
        "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;";
      document.body.append(holder);
      const samples = [
        {
          locale: "en",
          direction: "ltr",
          text: "AVATAR To office ffi fi — café naïve résumé",
        },
        {
          locale: "fa",
          direction: "rtl",
          text: "می\u200cخواهم فارسی ۱۲۳۴۵۶۷۸۹۰ 1234567890",
        },
        {
          locale: "ar",
          direction: "rtl",
          text: "اَلْعَرَبِيَّةُ لَا بِسْمِ اللَّهِ م\u200dر\u200dح\u200dب\u200dا ١٢٣٤٥",
        },
        {
          locale: "tr",
          direction: "ltr",
          text: "Tİ İT Şağrı Iğdır şeker çözücü ffi AV",
        },
      ];
      try {
        const rows = [];
        for (const sample of samples) {
          for (const weight of [100, 400, 500, 900]) {
            await document.fonts.load(
              `${weight} 64px ${candidateFamily}`,
              sample.text,
            );
            const measure = (family: string) => {
              const element = document.createElement("span");
              element.lang = sample.locale;
              element.dir = sample.direction;
              element.textContent = sample.text;
              // Both sides use browser-default shaping, ligatures and kerning.
              // Only the font family differs; this catches run boundaries
              // between the actual CSS unicode-range faces too.
              element.style.cssText =
                "display:inline-block;white-space:pre;font-size:64px;letter-spacing:normal;";
              element.style.fontFamily = family;
              element.style.fontWeight = String(weight);
              holder.append(element);
              const width = element.getBoundingClientRect().width;
              element.remove();
              return width;
            };
            rows.push({
              locale: sample.locale,
              weight,
              baseline: measure(baselineFamily),
              candidate: measure(candidateFamily),
            });
          }
        }
        return { candidateFamily, rows };
      } finally {
        holder.remove();
        document.fonts.delete(baseline);
      }
    }, baselineUrl);
    await test.info().attach("font-shaping-widths", {
      body: JSON.stringify(measurements, null, 2),
      contentType: "application/json",
    });
    expect(measurements.candidateFamily).toContain("Vazirmatn");
    expect(measurements.rows).toHaveLength(16);
    for (const row of measurements.rows) {
      expect(row.baseline).toBeGreaterThan(0);
      expect(row.candidate).toBeGreaterThan(0);
      expect(
        Math.abs(row.baseline - row.candidate),
        `${row.locale} weight ${row.weight}: original=${row.baseline}, subsets=${row.candidate}`,
      ).toBeLessThanOrEqual(0.5);
    }
  } finally {
    await context.close();
  }
});
