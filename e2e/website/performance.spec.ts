import { expect, test } from "@playwright/test";

import { setSiteLanguage, websiteOrigin } from "./helpers";

test("live language HTML and cookie proxy remain uncached while fonts stay self-hosted and vitals have no default transport", async ({
  page,
  request,
}) => {
  const requests: { method: string; url: string }[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== websiteOrigin) return route.abort();
    requests.push({ method: route.request().method(), url: url.href });
    return route.continue();
  });
  try {
    for (const code of ["en", "fa"] as const) {
      await setSiteLanguage(request, code);
      const response = await page.goto("/");
      expect(response?.headers()["cache-control"]).toContain("no-store");
      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        code === "fa" ? "rtl" : "ltr",
      );
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.getByRole("heading", { level: 1 }).click();
    }
    // Language setup's separate API context owns a synthetic administrator
    // cookie; inspect the still-anonymous browser context instead.
    const personal = await page.request.get(`${websiteOrigin}/api/account/me`);
    expect(personal.status()).toBe(401);
    expect(personal.headers()["cache-control"]).toBe("private, no-store");
    expect(
      requests.some(
        (item) => new URL(item.url).pathname === "/fonts/vazirmatn-latin.woff2",
      ),
    ).toBe(true);
    expect(requests.filter((item) => item.method !== "GET")).toEqual([]);
    expect(
      requests.every((item) => new URL(item.url).origin === websiteOrigin),
    ).toBe(true);
  } finally {
    await setSiteLanguage(request, "en");
  }
});
