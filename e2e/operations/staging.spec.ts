import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("authorized staging serves canonical routes, local assets, noindex and nonce policy", async ({
  page,
  request,
}, testInfo) => {
  const targets = testInfo.config.metadata.kernelBrowserTargets as {
    apiHealthUrl: string;
    baseUrl: string;
    mode: string;
  };
  expect(targets?.mode).toBe("staging");
  const origin = new URL(targets.baseUrl).origin;
  const failed: string[] = [];
  page.on("response", (response) => {
    if (
      ["font", "script", "stylesheet"].includes(
        response.request().resourceType(),
      ) &&
      (!response.ok() || new URL(response.url()).origin !== origin)
    )
      failed.push(response.url());
  });
  page.on("requestfailed", (request) => {
    if (["font", "script", "stylesheet"].includes(request.resourceType()))
      failed.push(request.url());
  });
  for (const route of ["/", "/login", "/register", "/forgot-password"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new URL(route, origin).href);
    await expect(page.locator("h1")).toBeVisible();
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    const headers = response!.headers();
    expect(
      headers["content-security-policy"] ??
        headers["content-security-policy-report-only"],
    ).toContain("'nonce-");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  expect(failed).toEqual([]);
  const health = await request.get(targets.apiHealthUrl, {
    maxRedirects: 0,
  });
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
});
