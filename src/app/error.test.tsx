// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import english from "@/i18n/catalog-data/locales/en.json";
import { TestIntlProvider } from "@/test/intl";

import ErrorPage from "./error";

describe("route error feedback", () => {
  it("renders a localized retry action and delegates to the framework retry callback", () => {
    const retry = vi.fn();
    const frameworkError = { error: "private diagnostic", retry };
    render(
      <TestIntlProvider>
        <ErrorPage {...frameworkError} />
      </TestIntlProvider>,
    );
    expect(
      screen.getByRole("heading", { name: english.feedbackErrorTitle }),
    ).toBeTruthy();
    expect(screen.queryByText("private diagnostic")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: english.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
