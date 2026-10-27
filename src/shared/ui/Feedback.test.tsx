// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import en from "@/i18n/catalog-data/locales/en";
import fa from "@/i18n/catalog-data/locales/fa";
import { WebsiteApiError } from "@/shared/api/client";
import { TestIntlProvider } from "@/test/intl";

import { Feedback } from "./Feedback";

describe("localized feedback", () => {
  it.each([
    new TypeError("Do not disclose transport details"),
    new WebsiteApiError("Internal details", 500),
    { message: "Untrusted object" },
  ])(
    "uses safe translated network feedback for transport/server/unknown errors",
    (error) => {
      render(
        <TestIntlProvider>
          <Feedback error={error} />
        </TestIntlProvider>,
      );
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain(en.unexpectedError);
      expect(alert.textContent).toContain(en.networkError);
      expect(alert.textContent).not.toContain("details");
      expect(alert.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    },
  );

  it("preserves user-facing errors as escaped text and prioritizes an error over success", () => {
    const message = "<script>unsafe()</script>";
    render(
      <TestIntlProvider>
        <Feedback error={new WebsiteApiError(message, 400)} success="Saved" />
      </TestIntlProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain(message);
    expect(screen.getByRole("alert").querySelector("script")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("uses the provider's real Persian catalog and does not choose another locale", () => {
    render(
      <TestIntlProvider locale="fa">
        <Feedback error={new TypeError("Offline")} />
      </TestIntlProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain(fa.networkError);
  });

  it("announces success without an error title and renders nothing for empty feedback", () => {
    const { rerender } = render(
      <TestIntlProvider>
        <Feedback success="Saved" />
      </TestIntlProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe("Saved");
    rerender(
      <TestIntlProvider>
        <Feedback />
      </TestIntlProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
