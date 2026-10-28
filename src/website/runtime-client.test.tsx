// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import CatchAll from "@/app/[...rest]/page";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";
import { SessionProvider } from "@/features/auth/SessionProvider";
import english from "@/i18n/catalog-data/locales/en";
import { TestIntlProvider } from "@/test/intl";
import { HeaderAccountLink } from "@/website/layouts/HeaderAccountLink";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } = await import("@/i18n/catalog-data/locales/en");
  return {
    getTranslations: async () => createTranslator({ locale: "en", messages }),
  };
});

function session(children: ReactNode) {
  return (
    <TestIntlProvider>
      <SessionProvider>{children}</SessionProvider>
    </TestIntlProvider>
  );
}

describe("live client session and recovery controls", () => {
  it("uses the actual loaded session to choose the header destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 401 })),
    );
    const anonymous = render(
      session(
        <HeaderAccountLink accountLabel="Your account" loginLabel="Sign in" />,
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
      ).toBe("/login"),
    );
    anonymous.unmount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "owned",
          first_name: "Ada",
          last_name: "Lovelace",
          mobile: "09120000000",
          is_system_admin: false,
          permissions: [],
          status: "active",
        }),
      ),
    );
    render(
      session(
        <HeaderAccountLink accountLabel="Your account" loginLabel="Sign in" />,
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Your account" }).getAttribute("href"),
      ).toBe("/account"),
    );
  });

  it("renders a localized retry action and delegates to the framework retry callback", () => {
    const retry = vi.fn();
    render(
      <TestIntlProvider>
        <ErrorPage error="private diagnostic" retry={retry} />
      </TestIntlProvider>,
    );
    expect(
      screen.getByRole("heading", { name: english.feedbackErrorTitle }),
    ).toBeTruthy();
    expect(screen.queryByText("private diagnostic")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: english.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("returns a real framework not-found signal and a localized recovery link", async () => {
    expect(() => CatchAll()).toThrow("NEXT_NOT_FOUND");
    render(<TestIntlProvider>{await NotFound()}</TestIntlProvider>);
    expect(
      screen.getByRole("heading", { name: english.feedbackNotFoundTitle }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: english.backHome }).getAttribute("href"),
    ).toBe("/");
  });

  it("provides a standalone bilingual fallback and a native reload action without context", () => {
    const fallback = GlobalError();
    const markup = renderToStaticMarkup(fallback);
    expect(markup).toContain('<html lang="en" dir="ltr"');
    expect(markup).toContain('<section lang="fa" dir="rtl"');
    expect(markup).toContain(english.globalErrorText);
    expect(markup).toContain('name="robots" content="noindex, nofollow"');
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const actions: Array<() => void> = [];
    const visit = (node: ReactNode) => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (
        isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)
      ) {
        if (node.type === "button" && node.props.onClick)
          actions.push(node.props.onClick);
        visit(node.props.children);
      }
    };
    try {
      visit(fallback);
      expect(actions).toHaveLength(1);
      actions[0]();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
