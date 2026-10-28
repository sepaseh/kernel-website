import { expect, test } from "@playwright/test";

import english from "@/i18n/catalog-data/locales/en";

import { registerAccount, setSiteLanguage, websiteOrigin } from "./helpers";

test("preserves the dynamic account link across server-shell and scoped-form navigation", async ({
  page,
  request,
}) => {
  const translationErrors: string[] = [];
  page.on("console", (message) => {
    if (/MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR/.test(message.text()))
      translationErrors.push(message.text());
  });
  await setSiteLanguage(request, "en");
  try {
    await page.goto("/");
    const header = page.getByRole("banner");
    const home = header.getByRole("link", {
      name: `Kernel · ${english.home}`,
      exact: true,
    });
    await header
      .getByRole("link", { name: english.login, exact: true })
      .click();
    await expect(page).toHaveURL(`${websiteOrigin}/login`);
    await expect(page.getByTestId("login-form")).toBeVisible();

    await registerAccount(page, "09180000016");
    await expect(
      header.getByRole("link", { name: english.account, exact: true }),
    ).toHaveAttribute("href", "/account");
    await home.click();
    await expect(page).toHaveURL(`${websiteOrigin}/`);
    await header
      .getByRole("link", { name: english.account, exact: true })
      .click();
    await expect(page.getByTestId("account-content")).toBeVisible();
    await page
      .getByRole("button", { name: english.accountLogout, exact: true })
      .click();
    await expect(page).toHaveURL(`${websiteOrigin}/login`);
    await expect(
      header.getByRole("link", { name: english.login, exact: true }),
    ).toHaveAttribute("href", "/login");
    await home.click();
    await expect(page).toHaveURL(`${websiteOrigin}/`);
    await expect(
      header.getByRole("link", { name: english.login, exact: true }),
    ).toBeVisible();
    expect(translationErrors).toEqual([]);
  } finally {
    await setSiteLanguage(request, "en");
  }
});
