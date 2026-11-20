import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import english from "@/i18n/catalog-data/locales/en.json" with { type: "json" };
import persian from "@/i18n/catalog-data/locales/fa.json" with { type: "json" };

import { apiOrigin, setSiteLanguage, websiteOrigin } from "./helpers";

const first = "/48629173/building-with-clear-boundaries";
const category = "/blog/categories/11111111-1111-4111-8111-111111111111";

test("blog layouts remain accessible across desktop and mobile RTL themes", async ({
  page,
  request,
}) => {
  const cases = [
    { code: "en" as const, width: 1280, height: 900, theme: "dark" },
    { code: "fa" as const, width: 390, height: 844, theme: "dark" },
    { code: "fa" as const, width: 390, height: 844, theme: "light" },
  ];
  for (const view of cases) {
    await setSiteLanguage(request, view.code);
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.goto(websiteOrigin + "/blog");
    const dark = (await page.locator("html").getAttribute("class"))
      ?.split(" ")
      .includes("dark");
    if (dark !== (view.theme === "dark")) {
      await page
        .getByRole("navigation", {
          name: view.code === "fa" ? persian.home : english.home,
          exact: true,
        })
        .getByRole("button", {
          name: view.code === "fa" ? persian.siteTheme : english.siteTheme,
          exact: true,
        })
        .click();
    }
    for (const [kind, path] of [
      ["list", "/blog"],
      ["article", first],
    ]) {
      await page.goto(websiteOrigin + path);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        view.code === "fa" ? "rtl" : "ltr",
      );
      if (kind === "article") {
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
          "direction",
          "ltr",
        );
        await expect(
          page.locator(".blog-prose p").filter({
            hasText: "Public articles arrive as server-rendered HTML.",
          }),
        ).toHaveCSS("direction", "ltr");
        await expect(
          page.locator(".blog-prose p").filter({
            hasText: "این نوشته برای خواندن روشن و ساده آماده شده است.",
          }),
        ).toHaveCSS("direction", "rtl");
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.screenshot({
        path: test
          .info()
          .outputPath(
            `blog-${view.code}-${view.theme}-${view.width}-${kind}.png`,
          ),
        fullPage: true,
      });
    }
  }
});

test("serves crawlable articles, category archives and self-canonical pagination without JavaScript", async ({
  browser,
  request,
}) => {
  await setSiteLanguage(request, "en");
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(websiteOrigin + "/blog");
    await expect(
      page.getByRole("heading", { level: 1, name: "Blog" }),
    ).toBeVisible();
    await expect(page.locator("main article")).toHaveCount(12);
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(websiteOrigin + "/blog/page/2");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      websiteOrigin + "/blog/page/2",
    );
    await expect(page.locator("main article")).toHaveCount(1);
    await page.goto(websiteOrigin + category);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Field notes",
    );
    await page.goto(websiteOrigin + first);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Building with clear boundaries",
    );
    await expect(
      page.getByText("Public articles arrive as server-rendered HTML."),
    ).toBeVisible();
    await expect(page.locator("article time")).toHaveCount(1);
    await expect(page.getByText("Foundations", { exact: true })).toBeVisible();
    await expect(page.locator('a[href*="/tags/"]')).toHaveCount(0);
    const data = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    const parsed = JSON.parse(data ?? "null");
    expect(parsed[0]["@type"]).toBe("BlogPosting");
    expect(parsed[0].author).toBeUndefined();
    expect(parsed[1]["@type"]).toBe("BreadcrumbList");
  } finally {
    await context.close();
  }
});

test("redirects only known published codes and never reveals an unpublished title", async ({
  request,
}) => {
  for (const path of ["/48629173", "/48629173/outdated-title"]) {
    const response = await request.get(websiteOrigin + path, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(first);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  for (const path of [
    "/87654321",
    "/87654321/old-title",
    "/99999999/anything",
    "/blog/page/99",
  ]) {
    const response = await request.get(websiteOrigin + path, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
    expect(await response.text()).not.toContain("A private draft");
  }
});

test("uses the API-selected RTL language and keeps an unpublished working preview private and revocable", async ({
  page,
  request,
}) => {
  await setSiteLanguage(request, "fa");
  await page.goto(websiteOrigin + "/blog");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مطالب");
  await setSiteLanguage(request, "en");
  const login = await request.post(apiOrigin + "/auth/login", {
    headers: { Origin: websiteOrigin },
    data: { identifier: "09123456789", password: "password123" },
  });
  expect(login.ok()).toBe(true);
  const { access_token: token } = await login.json();
  const write = (path: string) =>
    request.post(apiOrigin + path, {
      headers: { Origin: websiteOrigin, Authorization: `Bearer ${token}` },
      data: {},
    });
  const issued = await write("/posts/87654321/preview-token");
  expect(issued.ok()).toBe(true);
  const capability: { token: string } = await issued.json();
  try {
    const response = await page.goto(
      websiteOrigin +
        "/preview/87654321?token=" +
        encodeURIComponent(capability.token),
    );
    await expect(page).toHaveURL(websiteOrigin + "/preview/87654321/article");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A private draft",
    );
    await expect(
      page.getByText("Private saved working content."),
    ).toBeVisible();
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(
      page.locator('script[type="application/ld+json"]'),
    ).toHaveCount(0);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "kernel_blog_preview",
    );
    expect((await request.get(websiteOrigin + "/87654321")).status()).toBe(404);
    expect((await write("/posts/87654321/publish")).ok()).toBe(true);
    expect(
      (await request.get(websiteOrigin + "/87654321/a-private-draft")).status(),
    ).toBe(200);
    expect((await write("/posts/87654321/unpublish")).ok()).toBe(true);
    expect(
      (await request.get(websiteOrigin + "/87654321/a-private-draft")).status(),
    ).toBe(404);
    expect((await write("/auth/logout")).ok()).toBe(true);
    const revoked = await page.reload();
    expect(revoked?.status()).toBe(404);
    await expect(page.getByText("Private saved working content.")).toHaveCount(
      0,
    );
  } finally {
    await write("/posts/87654321/unpublish");
  }
});
