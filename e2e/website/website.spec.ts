import { expect, test } from "@playwright/test";

import { localeCodes } from "@/i18n/catalog-data/locales";
import english from "@/i18n/catalog-data/locales/en";
import persian from "@/i18n/catalog-data/locales/fa";
import { catalogs } from "@/i18n/catalogs";

import {
  assertNoHorizontalOverflow,
  capturePage,
  expectNoLanguageControl,
  fixtureCode,
  initialPassword,
  registerAccount,
  setSiteLanguage,
  signIn,
  websiteOrigin,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await setSiteLanguage(request, "en");
});
test.afterEach(async ({ request }) => {
  await setSiteLanguage(request, "en");
});

test("uses only persisted admin language on canonical URLs and SSR while preserving theme and keyboard access", async ({
  page,
  context,
  request,
}) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "fa", url: websiteOrigin },
  ]);
  await page.setExtraHTTPHeaders({ "Accept-Language": "fa-IR,fa;q=0.9" });
  await page.goto("/");
  await expect(page).toHaveURL(`${websiteOrigin}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expectNoLanguageControl(page);
  const englishLogin = await request.get(`${websiteOrigin}/login`, {
    headers: { "Accept-Language": "fa", Cookie: "NEXT_LOCALE=fa" },
  });
  expect(englishLogin.ok()).toBe(true);
  expect(await englishLogin.text()).toContain('lang="en"');
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const width of [360, 768, 1600]) {
    await page.setViewportSize({ height: 900, width });
    await assertNoHorizontalOverflow(page);
    await capturePage(
      page,
      `test-results/website/evidence/home-en-${width}.png`,
    );
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const initialDark = await page
    .locator("html")
    .evaluate((element) => element.classList.contains("dark"));
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Toggle color theme", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => element.classList.contains("dark")),
    )
    .not.toBe(initialDark);
  const dark = await page
    .locator("html")
    .evaluate((element) => element.classList.contains("dark"));
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => element.classList.contains("dark")),
    )
    .toBe(dark);
  await setSiteLanguage(request, "fa");
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: websiteOrigin },
  ]);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.reload();
  await expect(page).toHaveURL(`${websiteOrigin}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoLanguageControl(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const width of [360, 768, 1600]) {
    await page.setViewportSize({ height: 900, width });
    await assertNoHorizontalOverflow(page);
    await capturePage(
      page,
      `test-results/website/evidence/home-fa-${width}.png`,
    );
  }
  await page.goto("/login");
  await expect(page).toHaveURL(`${websiteOrigin}/login`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page).toHaveTitle(`${persian.login} · Kernel`);
  const persianTitle = await page.title();
  const persianLogin = await request.get(`${websiteOrigin}/login`, {
    headers: { "Accept-Language": "en", Cookie: "NEXT_LOCALE=en" },
  });
  expect(persianLogin.ok()).toBe(true);
  const persianHtml = await persianLogin.text();
  expect(persianHtml).toContain('lang="fa"');
  expect(persianHtml).toContain('dir="rtl"');
  for (const prefix of ["en", "fa"]) {
    const legacy = await request.get(
      `${websiteOrigin}/${prefix}/login?reset=success`,
      { maxRedirects: 0 },
    );
    expect(legacy.status()).toBe(308);
    expect(new URL(legacy.headers().location, websiteOrigin).pathname).toBe(
      "/login",
    );
    expect(new URL(legacy.headers().location, websiteOrigin).search).toBe(
      "?reset=success",
    );
  }
  await page.goto("/en/login?reset=success");
  await expect(page).toHaveURL(`${websiteOrigin}/login?reset=success`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await setSiteLanguage(request, "en");
  await page.reload();
  await expect(page).toHaveURL(`${websiteOrigin}/login?reset=success`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page).toHaveTitle(`${english.login} · Kernel`);
  await expect(page).not.toHaveTitle(persianTitle);
  await expectNoLanguageControl(page);
  const restoredLogin = await request.get(`${websiteOrigin}/login`, {
    headers: { "Accept-Language": "fa", Cookie: "NEXT_LOCALE=fa" },
  });
  expect(await restoredLogin.text()).toContain('lang="en"');
});

test("registers through the real API, restores the cookie session and updates account details", async ({
  page,
  context,
}) => {
  await registerAccount(page, "09180000011");
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.httpOnly && /session_token/.test(cookie.name),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /token|password|session/i.test(key),
      ),
    ),
  ).toEqual([]);
  await page.reload();
  const account = page.getByTestId("account-content");
  await expect(account).toBeVisible();
  const profileForm = account.locator("form").filter({
    has: page.getByLabel(english.firstName, { exact: true }),
  });
  await account.getByLabel(english.firstName, { exact: true }).fill("Updated");
  const profileSaved = page.waitForResponse(
    (response) =>
      response.url() === `${websiteOrigin}/api/account/update-profile` &&
      response.request().method() === "PATCH",
  );
  await account
    .getByRole("button", { name: english.accountSaveProfile, exact: true })
    .click();
  expect((await profileSaved).ok()).toBe(true);
  await expect(profileForm.getByRole("status")).toHaveText(
    english.accountProfileUpdated,
  );
  await expect(profileForm).toHaveAttribute("aria-busy", "false");
  await expect(
    account.getByLabel(english.firstName, { exact: true }),
  ).toHaveValue("Updated");
  const usernameForm = account.locator("form").filter({
    has: page.getByLabel(english.accountUsername, { exact: true }),
  });
  await account
    .getByLabel(english.accountUsername, { exact: true })
    .fill("website_tester_11");
  const usernameSaved = page.waitForResponse(
    (response) =>
      response.url() === `${websiteOrigin}/api/account/update-username` &&
      response.request().method() === "POST",
  );
  await account
    .getByRole("button", { name: english.accountSaveUsername, exact: true })
    .click();
  expect((await usernameSaved).ok()).toBe(true);
  await expect(usernameForm.getByRole("status")).toHaveText(
    english.accountUsernameUpdated,
  );
  await expect(usernameForm).toHaveAttribute("aria-busy", "false");
  const emailForm = account.locator("form").filter({
    has: page.getByLabel(english.accountEmailLabel, { exact: true }),
  });
  await emailForm
    .getByLabel(english.accountEmailLabel, { exact: true })
    .fill("website11@example.com");
  const emailCodeRequested = page.waitForResponse(
    (response) =>
      response.url() ===
        `${websiteOrigin}/api/account/request-email-verification` &&
      response.request().method() === "POST",
  );
  await emailForm
    .getByRole("button", { name: english.sendCode, exact: true })
    .click();
  expect((await emailCodeRequested).ok()).toBe(true);
  await expect(emailForm.getByRole("status")).toHaveText(english.codeRequested);
  await expect(emailForm).toHaveAttribute("aria-busy", "false");
  await emailForm.getByLabel(english.otp, { exact: true }).fill("000000");
  const invalidEmailCode = page.waitForResponse(
    (response) =>
      response.url() === `${websiteOrigin}/api/account/verify-email` &&
      response.request().method() === "POST",
  );
  await emailForm
    .getByRole("button", { name: english.accountVerifyEmail, exact: true })
    .click();
  expect((await invalidEmailCode).ok()).toBe(false);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(emailForm).toHaveAttribute("aria-busy", "false");
  await emailForm.getByLabel(english.otp, { exact: true }).fill(fixtureCode);
  const emailVerified = page.waitForResponse(
    (response) =>
      response.url() === `${websiteOrigin}/api/account/verify-email` &&
      response.request().method() === "POST",
  );
  await emailForm
    .getByRole("button", { name: english.accountVerifyEmail, exact: true })
    .click();
  expect((await emailVerified).ok()).toBe(true);
  await expect(emailForm.getByRole("status")).toHaveText(
    english.accountEmailVerified,
  );
  await expect(emailForm).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(
    account.getByLabel(english.firstName, { exact: true }),
  ).toHaveValue("Updated");
  await expect(
    account.getByLabel(english.accountUsername, { exact: true }),
  ).toHaveValue("website_tester_11");
  await expect(
    account.getByLabel(english.accountEmailLabel, { exact: true }),
  ).toHaveValue("website11@example.com");
  await page
    .getByRole("button", { name: english.accountLogout, exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, "09180000011", initialPassword);
  await expect(page.getByTestId("account-content")).toBeVisible();
});

test("changes and recovers a password with invalid-code rejection and subsequent real login", async ({
  page,
}) => {
  await registerAccount(page, "09180000012");
  const account = page.getByTestId("account-content");
  const changedPassword = "Website-changed-password-43";
  const recoveredPassword = "Website-recovered-password-44";
  await account
    .getByLabel(english.accountCurrentPassword, { exact: true })
    .fill(initialPassword);
  await account
    .getByLabel(english.newPassword, { exact: true })
    .fill(changedPassword);
  await account
    .getByLabel(english.confirmPassword, { exact: true })
    .fill(changedPassword);
  await account
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?password=changed$/);
  await expect(
    page.getByRole("status").filter({ hasText: /password/i }),
  ).toBeVisible();
  await signIn(page, "09180000012", changedPassword);
  await expect(page.getByTestId("account-content")).toBeVisible();
  await page
    .getByRole("button", { name: english.accountLogout, exact: true })
    .click();
  await page.goto("/forgot-password");
  const recovery = page.getByTestId("recovery-form");
  await recovery
    .getByLabel(english.mobile, { exact: true })
    .fill("09180000012");
  await recovery
    .getByRole("button", { name: english.sendCode, exact: true })
    .click();
  await recovery.getByLabel(english.otp, { exact: true }).fill("000000");
  await recovery
    .getByLabel(english.newPassword, { exact: true })
    .fill(recoveredPassword);
  await recovery
    .getByLabel(english.confirmPassword, { exact: true })
    .fill(recoveredPassword);
  await recovery
    .getByRole("button", { name: english.authResetPassword, exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await recovery.getByLabel(english.otp, { exact: true }).fill(fixtureCode);
  await recovery
    .getByRole("button", { name: english.authResetPassword, exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, "09180000012", changedPassword);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, "09180000012", recoveredPassword);
  await expect(page.getByTestId("account-content")).toBeVisible();
});

test("retains registration data after an invalid verification code and keeps legacy prefixes from selecting language", async ({
  page,
}) => {
  await page.goto("/register");
  const form = page.getByTestId("register-form");
  await form.getByLabel(english.firstName, { exact: true }).fill("Invalid");
  await form.getByLabel(english.lastName, { exact: true }).fill("Code");
  await form.getByLabel(english.mobile, { exact: true }).fill("09180000013");
  await form
    .getByRole("button", { name: english.sendCode, exact: true })
    .click();
  await form.getByLabel(english.otp, { exact: true }).fill("000000");
  await form
    .getByLabel(english.password, { exact: true })
    .fill(initialPassword);
  await form
    .getByLabel(english.confirmPassword, { exact: true })
    .fill(initialPassword);
  await form
    .getByRole("button", { name: english.register, exact: true })
    .click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(form.getByLabel(english.firstName, { exact: true })).toHaveValue(
    "Invalid",
  );
  await form.getByLabel(english.otp, { exact: true }).fill(fixtureCode);
  await form
    .getByRole("button", { name: english.register, exact: true })
    .click();
  await expect(page.getByTestId("account-content")).toBeVisible();
  await page
    .getByRole("button", { name: english.accountLogout, exact: true })
    .click();
  await page.goto("/fa/login?from=legacy");
  await page.setViewportSize({ height: 900, width: 360 });
  await expect(page).toHaveURL(`${websiteOrigin}/login?from=legacy`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await expectNoLanguageControl(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

for (const locale of localeCodes) {
  test(`renders persisted '${locale}' on canonical pages and raw SSR despite conflicting visitor preferences`, async ({
    page,
    context,
    request,
  }) => {
    const messages = (await catalogs[locale]()).default;

    const otherLocale = locale === "en" ? "fa" : "en";
    const translationErrors: string[] = [];
    page.on("console", (message) => {
      if (
        /MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR/.test(message.text())
      )
        translationErrors.push(message.text());
    });
    const configuredLanguage = await setSiteLanguage(request, locale);
    await context.addCookies([
      { name: "NEXT_LOCALE", value: otherLocale, url: websiteOrigin },
    ]);
    await page.setExtraHTTPHeaders({ "Accept-Language": otherLocale });
    await page.setViewportSize({ height: 900, width: 360 });
    await page.goto("/login");
    await expect(page).toHaveURL(`${websiteOrigin}/login`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      configuredLanguage.direction,
    );
    await expect(page).toHaveTitle(`${messages.login} · Kernel`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.authLoginTitle,
    );
    const loginForm = page.getByTestId("login-form");
    await expect(
      loginForm.getByLabel(messages.mobile, { exact: true }),
    ).toBeVisible();
    await expect(
      loginForm.getByLabel(messages.password, { exact: true }),
    ).toBeVisible();
    await expect(
      loginForm.getByRole("button", { name: messages.login, exact: true }),
    ).toBeVisible();
    await expectNoLanguageControl(page);
    await assertNoHorizontalOverflow(page);

    const response = await request.get(`${websiteOrigin}/login`, {
      headers: {
        "Accept-Language": otherLocale,
        Cookie: `NEXT_LOCALE=${otherLocale}`,
      },
    });
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
    expect(html).toMatch(
      new RegExp(`<html[^>]*dir="${configuredLanguage.direction}"`),
    );
    expect(html).toContain(`<title>${messages.login} · Kernel</title>`);

    await page.goto("/");
    await expect(page).toHaveURL(`${websiteOrigin}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      messages.homeTitle,
    );
    await assertNoHorizontalOverflow(page);
    expect(translationErrors).toEqual([]);
  });
}
