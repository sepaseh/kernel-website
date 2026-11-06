// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/features/auth/session/SessionProvider";
import { TestIntlProvider } from "@/test/intl";

import { HeaderAccountLink } from "./HeaderAccountLink";

function session(children: ReactNode) {
  return (
    <TestIntlProvider>
      <SessionProvider>{children}</SessionProvider>
    </TestIntlProvider>
  );
}

describe("header session destination", () => {
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
});
