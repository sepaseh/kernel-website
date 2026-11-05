import { expect, test } from "@playwright/test";

test("authorized release serves its expected marker, standalone assets and API health", async ({
  page,
  request,
}, testInfo) => {
  const targets = testInfo.config.metadata.kernelBrowserTargets as {
    apiHealthUrl: string;
    deploymentId: string;
    mode: string;
  };
  expect(targets?.mode).toBe("smoke");
  const failed: string[] = [];
  page.on("response", (response) => {
    if (
      ["font", "script", "stylesheet"].includes(
        response.request().resourceType(),
      ) &&
      !response.ok()
    )
      failed.push(response.url());
  });
  for (const route of ["/login", "/register"]) {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator("form")).toBeVisible();
  }
  expect(failed).toEqual([]);
  const release = await request.get("/_kernel/release", { maxRedirects: 0 });
  expect(release.status()).toBe(200);
  expect((await release.json()).release).toBe(targets.deploymentId);
  const health = await request.get(targets.apiHealthUrl, {
    maxRedirects: 0,
  });
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
});
