import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";

import en from "@/i18n/catalog-data/locales/en.json" with { type: "json" };
import fa from "@/i18n/catalog-data/locales/fa.json" with { type: "json" };
import { profileNameMaxLength } from "@/shared/contracts";

import { fixtureCode, setSiteLanguage, websiteOrigin } from "./helpers";

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
        const tabStopCount = await page
          .locator("a[href], button, input, select, textarea, [tabindex]")
          .evaluateAll(
            (elements) =>
              elements.filter(
                (element) =>
                  element instanceof HTMLElement &&
                  element.tabIndex >= 0 &&
                  !element.hasAttribute("disabled") &&
                  element.getClientRects().length > 0 &&
                  getComputedStyle(element).visibility !== "hidden",
              ).length,
          );
        for (let index = 0; index < tabStopCount; index++) {
          await page.keyboard.press("Tab");
          if (
            await toggle.evaluate(
              (element) => document.activeElement === element,
            )
          )
            break;
        }
        await expect(toggle).toBeFocused();
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
        const registration = page.getByTestId("register-form");
        const names = [messages.firstName, messages.lastName].map((label) =>
          registration.getByLabel(label, { exact: true }),
        );
        const boundaryName = "😀".repeat(profileNameMaxLength / 2);
        const paddedName = `  ${boundaryName}  `;
        expect(boundaryName.length).toBe(profileNameMaxLength);
        for (const name of names) {
          await expect(name).not.toHaveAttribute("maxlength");
          await name.fill(paddedName);
        }
        await registration
          .getByLabel(messages.mobile, { exact: true })
          .fill("09189999999");
        await registration
          .getByLabel(messages.otp, { exact: true })
          .fill(fixtureCode);
        const password = "  accessible-password  ";
        for (const label of [messages.password, messages.confirmPassword])
          await registration.getByLabel(label, { exact: true }).fill(password);
        const endpoint = `${websiteOrigin}/api/auth/register`;
        let registrationRequests = 0;
        await page.route(endpoint, (route) => {
          registrationRequests++;
          return route.fulfill({
            status: 422,
            json: { message: "Owned registration validation probe." },
          });
        });
        const submit = registration.getByRole("button", {
          name: messages.register,
          exact: true,
        });
        for (const name of names) {
          const oversizedName = `  ${boundaryName}a  `;
          await name.fill(oversizedName);
          await submit.press("Enter");
          await expect(registration.getByRole("alert")).toContainText(
            messages.nameTooLong.replace("{max}", String(profileNameMaxLength)),
          );
          await expect(name).toHaveValue(oversizedName);
          expect(registrationRequests).toBe(0);
          await name.fill(paddedName);
        }
        const submitted = page.waitForResponse(
          (response) =>
            response.url() === endpoint &&
            response.request().method() === "POST",
        );
        await submit.press("Enter");
        const accepted = await submitted;
        expect(accepted.status()).toBe(422);
        expect(accepted.request().postDataJSON()).toEqual({
          first_name: boundaryName,
          last_name: boundaryName,
          mobile: "09189999999",
          otp: fixtureCode,
          password,
        });
        expect(registrationRequests).toBe(1);
        for (const name of names) await expect(name).toHaveValue(paddedName);
      });
    });
  }
}
