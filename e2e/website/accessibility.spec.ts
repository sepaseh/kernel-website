import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";

import en from "@/i18n/catalog-data/locales/en";
import fa from "@/i18n/catalog-data/locales/fa";
import { profileNameMaxLength } from "@/shared/contracts";

import { setSiteLanguage, websiteOrigin } from "./helpers";

const websiteMessages = { en, fa };

let accountState: Awaited<ReturnType<APIRequestContext["storageState"]>>;

test.beforeAll(async ({ playwright }) => {
  // Only the disposable fixture's seeded account is used. Retain official
  // cookies privately in the runner, never tokens in browser storage.
  const client = await playwright.request.newContext({
    baseURL: websiteOrigin,
  });
  try {
    const login = await client.post("/api/auth/login", {
      data: { identifier: "09123456789", password: "password123" },
      headers: { Origin: websiteOrigin },
    });
    expect(login.ok()).toBe(true);
    expect(await login.json()).not.toHaveProperty("access_token");
    accountState = await client.storageState();
  } finally {
    await client.dispose();
  }
});

const expectNoAxeViolations = async (page: Page, info: TestInfo) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const { violations, incomplete } = await new AxeBuilder({ page }).analyze();
  await info.attach(`axe-${info.attachments.length}`, {
    body: JSON.stringify({ violations, incomplete }, null, 2),
    contentType: "application/json",
  });
  expect(violations).toEqual([]);
};

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`website accessibility ${language} ${theme}`, () => {
      test.beforeEach(async ({ page, request }) => {
        await setSiteLanguage(request, language);
        await page.addInitScript(
          (mode) => localStorage.setItem("kernel-website-theme", mode),
          theme,
        );
        await page.route("**/*", (route) =>
          new URL(route.request().url()).origin === websiteOrigin
            ? route.continue()
            : route.abort(),
        );
      });

      test("public pages and connected account have no detectable violations including contrast", async ({
        page,
        context,
      }, info) => {
        for (const path of ["/", "/login", "/register", "/forgot-password"]) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          await expect(page.locator("html")).toHaveClass(new RegExp(theme));
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoAxeViolations(page, info);
        }
        await context.addCookies(accountState.cookies);
        await page.goto("/account");
        await expect(page.getByTestId("account-content")).toBeVisible();
        await expectNoAxeViolations(page, info);
      });

      test("skip link, theme toggle and invalid form work with keyboard and visible focus", async ({
        page,
      }) => {
        const messages = websiteMessages[language];
        await page.goto("/");
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", {
          name: messages.siteSkip,
          exact: true,
        });
        await expect(skip).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("main")).toBeFocused();
        const toggle = page.getByRole("banner").getByRole("button", {
          name: messages.siteTheme,
          exact: true,
        });
        await toggle.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("html")).toHaveClass(
          new RegExp(theme === "dark" ? "light" : "dark"),
        );
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveCSS("outline-width", "2px");
        await page.goto("/login");
        const form = page.getByTestId("login-form");
        const mobile = form.getByLabel(messages.mobile, { exact: true });
        await mobile.focus();
        await page.keyboard.press("Tab");
        await expect(
          form.getByLabel(messages.password, { exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(mobile).toBeFocused();
        await expect(mobile).toHaveCSS("outline-width", "2px");
        await form
          .getByRole("button", { name: messages.login, exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await expect(mobile).toBeFocused();
        expect(
          await mobile.evaluate(
            (input: HTMLInputElement) => input.validity.valueMissing,
          ),
        ).toBe(true);
        await page.goto("/register");
        await expect(
          page
            .getByTestId("register-form")
            .getByLabel(messages.firstName, { exact: true }),
        ).toHaveAttribute("maxlength", String(profileNameMaxLength));
      });
    });
  }
}
