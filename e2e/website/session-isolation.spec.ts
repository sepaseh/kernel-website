import { expect, test } from "@playwright/test";

import english from "@/i18n/catalog-data/locales/en";

import {
  fixtureCode,
  initialPassword,
  setSiteLanguage,
  websiteOrigin,
} from "./helpers";

test("an old profile save cannot replace the account loaded after logout and a fresh login", async ({
  page,
  playwright,
  request,
}) => {
  await setSiteLanguage(request, "en");
  const firstMobile = "09180000181";
  const secondMobile = "09180000182";
  for (const [mobile, firstName] of [
    [firstMobile, "Previous"],
    [secondMobile, "Current"],
  ]) {
    const client = await playwright.request.newContext({
      baseURL: websiteOrigin,
    });
    try {
      expect(
        (
          await client.post("/api/auth/otp-request", {
            data: { mobile, purpose: "register" },
            headers: { Origin: websiteOrigin },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await client.post("/api/auth/register", {
            data: {
              first_name: firstName,
              last_name: "Session",
              mobile,
              otp: fixtureCode,
              password: initialPassword,
            },
            headers: { Origin: websiteOrigin },
          })
        ).status(),
      ).toBe(201);
    } finally {
      await client.dispose();
    }
  }

  await page.goto("/login");
  const login = page.getByTestId("login-form");
  await login.getByLabel(english.mobile, { exact: true }).fill(firstMobile);
  await login
    .getByLabel(english.password, { exact: true })
    .fill(initialPassword);
  await login.getByRole("button", { name: english.login, exact: true }).click();
  const account = page.getByTestId("account-content");
  await expect(account).toBeVisible();

  let release!: () => void;
  let saved!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mutationSaved = new Promise<void>((resolve) => {
    saved = resolve;
  });
  await page.route("**/api/account/update-profile", async (route) => {
    // Commit to the real old account, then hold only its response. The new
    // session must win even when cancellation cannot undo the completed write.
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    saved();
    await blocked;
    await route.fulfill({ response });
  });
  try {
    await account
      .getByLabel(english.firstName, { exact: true })
      .fill("OldProfile");
    await account
      .getByRole("button", { name: english.accountSaveProfile, exact: true })
      .click();
    await mutationSaved;
    await account
      .getByRole("button", { name: english.accountLogout, exact: true })
      .click();
    await expect(page).toHaveURL(`${websiteOrigin}/login`);
    // Stay in the same document: a full page.goto would discard the old
    // JavaScript callback and hide the session-generation regression.
    await login.getByLabel(english.mobile, { exact: true }).fill(secondMobile);
    await login
      .getByLabel(english.password, { exact: true })
      .fill(initialPassword);
    await login
      .getByRole("button", { name: english.login, exact: true })
      .click();
    await expect(account).toBeVisible();
    await expect(
      account.getByLabel(english.firstName, { exact: true }),
    ).toHaveValue("Current");
    const completed = page.waitForEvent("requestfinished", {
      predicate: (value) => value.url().endsWith("/api/account/update-profile"),
    });
    release();
    await completed;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await expect(account).toBeVisible();
    await expect(
      account.getByLabel(english.firstName, { exact: true }),
    ).toHaveValue("Current");
    await expect(
      account.getByLabel(english.mobile, { exact: true }),
    ).toHaveValue(secondMobile);
  } finally {
    release();
  }
});
