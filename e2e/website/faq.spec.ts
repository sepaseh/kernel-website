import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import en from "@/i18n/catalog-data/locales/en.json" with { type: "json" };
import fa from "@/i18n/catalog-data/locales/fa.json" with { type: "json" };

import { apiOrigin, setSiteLanguage, websiteOrigin } from "./helpers";

test("FAQ disclosures and canonical pagination work without JavaScript", async ({
  browser,
  request,
}) => {
  await setSiteLanguage(request, "en");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto(websiteOrigin);
    await page.getByRole("link", { name: en.faq, exact: true }).click();
    await expect(page).toHaveURL(websiteOrigin + "/faq");
    await expect(page.locator("details")).toHaveCount(20);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      websiteOrigin + "/faq",
    );
    await expect(
      page.getByText("Inactive fixture question", { exact: true }),
    ).toHaveCount(0);
    const first = page.locator("details").first();
    await first.locator("summary").focus();
    await first.locator("summary").press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.locator("div")).toContainText(
      "<script>Plain text stays plain.</script>",
    );
    await expect(first.locator("script")).toHaveCount(0);
    await first.locator("summary").press("Space");
    await expect(first).not.toHaveAttribute("open", "");
    await page.locator('a[rel="next"]').click();
    await expect(page).toHaveURL(websiteOrigin + "/faq/page/2");
    await expect(page.locator("details")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      websiteOrigin + "/faq/page/2",
    );
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute("href", "/faq");
    await expect(page.locator('a[rel="next"]')).toHaveCount(0);
    const canonical = await request.get(websiteOrigin + "/faq/page/1", {
      maxRedirects: 0,
    });
    expect(canonical.status()).toBe(308);
    expect(canonical.headers().location).toBe("/faq");
    for (const path of [
      "/faq/page/0",
      "/faq/page/01",
      "/faq/page/3",
      "/faq/page/500002",
      "/faq/unknown",
    ]) {
      const missing = await request.get(websiteOrigin + path);
      expect(missing.status(), path).toBe(404);
    }
    const raw = await (await request.get(websiteOrigin + "/faq")).text();
    expect(raw).toContain(
      "&lt;script&gt;Plain text stays plain.&lt;/script&gt;",
    );
    expect(raw).not.toContain('"@type":"FAQPage"');
  } finally {
    await context.close();
  }
});

test("FAQ remains accessible and readable on desktop/mobile in both directions and themes", async ({
  page,
  request,
}) => {
  const cases = [
    { code: "en" as const, width: 1280, dark: true },
    { code: "en" as const, width: 390, dark: false },
    { code: "fa" as const, width: 1280, dark: false },
    { code: "fa" as const, width: 390, dark: true },
  ];
  for (const view of cases) {
    await setSiteLanguage(request, view.code);
    const messages = view.code === "en" ? en : fa;
    await page.setViewportSize({ width: view.width, height: 900 });
    await page.goto(websiteOrigin + "/faq");
    const dark = (await page.locator("html").getAttribute("class"))
      ?.split(" ")
      .includes("dark");
    if (dark !== view.dark)
      await page
        .getByRole("navigation", { name: messages.home, exact: true })
        .getByRole("button", { name: messages.siteTheme, exact: true })
        .click();
    await expect(
      page.getByRole("heading", { name: messages.faq, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      view.code === "fa" ? "rtl" : "ltr",
    );
    await page.locator("summary").first().click();
    await expect(page.locator("details").first()).toHaveAttribute("open", "");
    await expect(page.locator("details").first().locator("div")).toHaveCSS(
      "unicode-bidi",
      "plaintext",
    );
    await expect(
      page.getByText("از کجا شروع کنم؟", { exact: true }),
    ).toHaveAttribute("dir", "auto");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({
      path: test.info().outputPath(`faq-${view.code}-${view.width}.png`),
      fullPage: true,
    });
  }
});

test("FAQ contains long plain text and immediately reflects activation and an empty public list", async ({
  page,
  request,
}) => {
  await setSiteLanguage(request, "fa");
  const login = await request.post(apiOrigin + "/auth/login", {
    headers: { Origin: websiteOrigin },
    data: { identifier: "09123456789", password: "password123" },
  });
  const { access_token } = await login.json();
  const original = await (
    await request.get(apiOrigin + "/public/faqs?offset=0&size=100")
  ).json();
  const patch = async (id: string, data: Record<string, unknown>) => {
    const response = await request.patch(apiOrigin + "/faqs/" + id, {
      headers: {
        Origin: websiteOrigin,
        Authorization: `Bearer ${access_token}`,
      },
      data,
    });
    expect(response.status()).toBe(200);
  };
  try {
    await patch(original.items[0].id, {
      question: "Q".repeat(300),
      answer: "A".repeat(5000),
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(websiteOrigin + "/faq");
    await page.locator("summary").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const item of original.items)
      await patch(item.id, { is_active: false });
    const empty = await page.goto(websiteOrigin + "/faq");
    expect(empty?.status()).toBe(200);
    await expect(page.getByText(fa.faqEmpty, { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    expect((await request.get(websiteOrigin + "/faq/page/2")).status()).toBe(
      404,
    );
    await patch(original.items[0].id, {
      question: original.items[0].question,
      answer: original.items[0].answer,
      sort: original.items[0].sort,
      is_active: true,
    });
    await page.goto(websiteOrigin + "/faq");
    await expect(page.locator("details")).toHaveCount(1);
  } finally {
    for (const item of original.items)
      await patch(item.id, {
        question: item.question,
        answer: item.answer,
        sort: item.sort,
        is_active: true,
      });
  }
});
