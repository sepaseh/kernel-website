import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { LocaleCode } from "@/i18n/catalog-data/locales";
import english from "@/i18n/catalog-data/locales/en";
import type { PublicSettingsResponse } from "@/shared/settings/contracts";

export const fixtureCode = "123456";
export const initialPassword = "Website-example-password-42";

function loopbackOrigin(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} must be an explicit fixture origin.`);
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    Number(url.port) === 0 ||
    value !== url.origin
  )
    throw new Error(
      `${name} must be a canonical HTTP IPv4 loopback origin with an explicit nonzero port.`,
    );
  return url.origin;
}

export const apiOrigin = loopbackOrigin(
  process.env.API_BASE_URL,
  "API_BASE_URL",
);
export const websiteOrigin = loopbackOrigin(
  process.env.WEBSITE_URL,
  "WEBSITE_URL",
);
if (apiOrigin === websiteOrigin)
  throw new Error("Website and API fixture origins must be distinct.");

// This module runs only against the disposable seeded fixture. Reuse its
// administrator session so locale coverage does not turn into login flooding.
let languageAdministratorToken: string | undefined;

export const setSiteLanguage = async (
  request: APIRequestContext,
  code: LocaleCode,
) => {
  const current = await request.get(`${apiOrigin}/settings`);
  expect(current.ok()).toBe(true);
  expect(current.headers()["cache-control"]).toContain("no-store");
  const settings: PublicSettingsResponse = await current.json();
  if (settings.language.code === code) return settings.language;
  if (!languageAdministratorToken) {
    const login = await request.post(`${apiOrigin}/auth/login`, {
      data: { identifier: "09123456789", password: "password123" },
      headers: { Origin: websiteOrigin },
    });
    expect(login.ok()).toBe(true);
    const { access_token } = await login.json();
    expect(typeof access_token).toBe("string");
    languageAdministratorToken = access_token;
  }
  const saved = await request.put(`${apiOrigin}/settings`, {
    data: {
      dark_logo_id: settings.dark_logo?.id,
      dark_theme: settings.dark_theme,
      language_code: code,
      light_logo_id: settings.light_logo?.id,
      light_theme: settings.light_theme,
    },
    headers: {
      Authorization: `Bearer ${languageAdministratorToken}`,
      Origin: websiteOrigin,
    },
  });
  expect(saved.ok()).toBe(true);
  const updated: PublicSettingsResponse = await saved.json();
  expect(updated.language.code).toBe(code);
  return updated.language;
};

export const expectNoLanguageControl = async (page: Page) => {
  await expect(
    page.getByRole("link", { name: /Switch to Persian|Switch to English/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /language|زبان|Switch to/i }),
  ).toHaveCount(0);
};

export const capturePage = async (page: Page, target: string) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const reveals = page.locator('main [style*="opacity"]');
  for (let index = 0; index < (await reveals.count()); index++) {
    const reveal = reveals.nth(index);
    await reveal.scrollIntoViewIfNeeded();
    await expect(reveal).toHaveCSS("opacity", "1");
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: target,
    fullPage: true,
    animations: "disabled",
  });
};

export const assertNoHorizontalOverflow = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    width: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll("body *")]
      .map((element) => ({
        className: element.getAttribute("class"),
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        tag: element.tagName,
      }))
      .filter(
        (element) => element.left < -1 || element.right > window.innerWidth + 1,
      )
      .slice(0, 8),
  }));
  expect(geometry.width, JSON.stringify(geometry)).toBeLessThanOrEqual(
    geometry.viewport,
  );
};

export const registerAccount = async (page: Page, mobile: string) => {
  await page.setViewportSize({ height: 900, width: 360 });
  await page.goto("/register");
  const form = page.getByTestId("register-form");
  await form.getByLabel(english.firstName, { exact: true }).fill("Website");
  await form.getByLabel(english.lastName, { exact: true }).fill("Tester");
  await form.getByLabel(english.mobile, { exact: true }).fill(mobile);
  const requestedCode = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/otp-request") &&
      response.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: english.sendCode, exact: true })
    .click();
  expect((await requestedCode).status()).toBe(200);
  await expect(form.getByRole("button", { name: /\d/ }).first()).toBeDisabled();
  await assertNoHorizontalOverflow(page);
  await form.getByLabel(english.otp, { exact: true }).fill(fixtureCode);
  await form
    .getByLabel(english.password, { exact: true })
    .fill(initialPassword);
  await form
    .getByLabel(english.confirmPassword, { exact: true })
    .fill(initialPassword);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") &&
      response.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: english.register, exact: true })
    .click();
  const registered = await created;
  expect(registered.status()).toBe(201);
  expect(await registered.json()).not.toHaveProperty("access_token");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("account-content")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await capturePage(page, "test-results/website/evidence/account-en-360.png");
};

export const signIn = async (page: Page, mobile: string, password: string) => {
  await page.goto("/login");
  const form = page.getByTestId("login-form");
  await assertNoHorizontalOverflow(page);
  await capturePage(page, "test-results/website/evidence/login-en-360.png");
  await form.getByLabel(english.mobile, { exact: true }).fill(mobile);
  await form.getByLabel(english.password, { exact: true }).fill(password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: english.login, exact: true }).click();
  expect(await (await signedIn).json()).not.toHaveProperty("access_token");
};
