import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import en from "@/i18n/catalog-data/locales/en.json" with { type: "json" };
import fa from "@/i18n/catalog-data/locales/fa.json" with { type: "json" };

import { apiOrigin, setSiteLanguage, websiteOrigin } from "./helpers";

test("contact is discoverable and keeps an uncertain retry anonymous and idempotent", async ({
  page,
  request,
}) => {
  await setSiteLanguage(request, "en");
  await page.goto(websiteOrigin);
  await page.getByRole("link", { name: en.contact, exact: true }).click();
  await expect(page).toHaveURL(websiteOrigin + "/contact");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    websiteOrigin + "/contact",
  );
  await expect(page.getByRole("textbox")).toHaveCount(3);
  await page
    .getByLabel(en.contactName, { exact: true })
    .fill("Contact retry fixture");
  await page.getByLabel(en.contactMobile, { exact: true }).fill("۰۹۱۲۰۰۰۰۱۰۱");
  await page
    .getByLabel(en.contactDescription, { exact: true })
    .fill("<script>plain text</script>\nSecond line");
  const keys: string[] = [];
  await page.route("**/api/public/contact-messages", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    expect(route.request().headers().authorization).toBeUndefined();
    const result = await route.fetch();
    if (keys.length === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Synthetic uncertain response after acceptance",
        }),
      });
    else await route.fulfill({ response: result });
  });
  await page.getByRole("button", { name: en.contactSend }).click();
  await expect(page.getByRole("form").getByRole("alert")).toContainText(
    en.networkError,
  );
  await expect(page.getByLabel(en.contactDescription)).toHaveValue(
    "<script>plain text</script>\nSecond line",
  );
  await page.getByRole("button", { name: en.contactSend }).click();
  await expect(page.getByRole("status")).toContainText(en.contactSuccess);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const login = await request.post(apiOrigin + "/auth/login", {
    headers: { Origin: websiteOrigin },
    data: { identifier: "09123456789", password: "password123" },
  });
  const { access_token } = await login.json();
  const inbox = await (
    await request.get(apiOrigin + "/contact-messages", {
      headers: { Authorization: `Bearer ${access_token}` },
    })
  ).json();
  expect(
    inbox.items.filter(
      (item: { name: string }) => item.name === "Contact retry fixture",
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: en.contactAnother }).click();
  await expect(page.getByLabel(en.contactName)).toHaveValue("");
});

test("contact has accessible required fields and readable RTL/LTR layouts in both themes", async ({
  page,
  request,
}) => {
  for (const code of ["en", "fa"] as const) {
    await setSiteLanguage(request, code);
    const messages = code === "en" ? en : fa;
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(websiteOrigin + "/contact");
      const dark = (await page.locator("html").getAttribute("class"))
        ?.split(" ")
        .includes("dark");
      if (dark !== (code === "fa"))
        await page
          .getByRole("navigation", { name: messages.home, exact: true })
          .getByRole("button", { name: messages.siteTheme })
          .click();
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        code === "fa" ? "rtl" : "ltr",
      );
      await page.getByRole("button", { name: messages.contactSend }).click();
      await expect(
        page.getByLabel(messages.contactName, { exact: true }),
      ).toBeFocused();
      await expect(
        page.getByLabel(messages.contactMobile, { exact: true }),
      ).toHaveAttribute("dir", "ltr");
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.reload();
      await expect(page.getByText("+989", { exact: true })).toHaveAttribute(
        "dir",
        "ltr",
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.screenshot({
        path: test.info().outputPath(`contact-${code}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
