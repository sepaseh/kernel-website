// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import english from "@/i18n/catalog-data/locales/en.json";
import { TestIntlProvider } from "@/test/intl";

import NotFound from "./not-found";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } =
    await import("@/i18n/catalog-data/locales/en.json");
  return {
    getTranslations: async () => createTranslator({ locale: "en", messages }),
  };
});

describe("not-found recovery", () => {
  it("renders a localized recovery link", async () => {
    render(<TestIntlProvider>{await NotFound()}</TestIntlProvider>);
    expect(
      screen.getByRole("heading", { name: english.feedbackNotFoundTitle }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: english.backHome }).getAttribute("href"),
    ).toBe("/");
  });
});
