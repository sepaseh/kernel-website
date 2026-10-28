import { expect, test } from "@playwright/test";

import english from "@/i18n/catalog-data/locales/en";
import persian from "@/i18n/catalog-data/locales/fa";

// Reuse the existing temporary real-API fixture, never operator settings.
import { setSiteLanguage, websiteOrigin } from "../website/helpers";
import { waitForVisualFonts } from "./readiness";

for (const scenario of [
  {
    name: "website-home-en-dark",
    path: "/",
    language: "en",
    theme: "dark",
    width: 1280,
  },
  {
    name: "website-login-en-light",
    path: "/login",
    language: "en",
    theme: "light",
    width: 1280,
  },
  {
    name: "website-register-fa-light",
    path: "/register",
    language: "fa",
    theme: "light",
    width: 360,
  },
  {
    name: "website-home-fa-dark",
    path: "/",
    language: "fa",
    theme: "dark",
    width: 360,
  },
] as const) {
  test(scenario.name, async ({ page, request }) => {
    await setSiteLanguage(request, scenario.language);
    try {
      await page.setViewportSize({ width: scenario.width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("kernel-website-theme", theme),
        scenario.theme,
      );
      const unexpectedRequests: string[] = [];
      await page.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === websiteOrigin)
          return route.continue();
        unexpectedRequests.push(route.request().url());
        return route.abort();
      });
      await page.goto(`${websiteOrigin}${scenario.path}`);
      const messages = scenario.language === "en" ? english : persian;
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        scenario.language,
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (scenario.path === "/")
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          messages.homeTitle,
        );
      else
        await expect(
          page.getByRole("button", {
            name:
              scenario.path === "/login" ? messages.login : messages.register,
            exact: true,
          }),
        ).toBeVisible();
      if (scenario.theme === "dark")
        await expect(page.locator("html")).toHaveClass(/dark/);
      else await expect(page.locator("html")).not.toHaveClass(/dark/);
      await waitForVisualFonts(page);
      await expect(page).toHaveScreenshot(`${scenario.name}.png`, {
        fullPage: scenario.path === "/register",
      });
      expect(unexpectedRequests).toEqual([]);
    } finally {
      await setSiteLanguage(request, "en");
    }
  });
}
