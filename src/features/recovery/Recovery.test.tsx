// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@/features/auth/SessionProvider";
import en from "@/i18n/catalog-data/locales/en";
import { FeatureTestProvider } from "@/test/feature-session";

import { Recovery } from "./Recovery";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
// The Next router is mocked; no framework/browser-navigation claim is made.
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const anonymous = () =>
  Response.json({ message: "No session" }, { status: 401 });
const deferred = () => {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};

function SessionProbe() {
  const { loading } = useSession();
  return (
    <span aria-label="session ready">{loading ? "loading" : "ready"}</span>
  );
}

async function mount(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <FeatureTestProvider>
      <SessionProbe />
      <Recovery />
    </FeatureTestProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("session ready").textContent).toBe("ready"),
  );
  return view;
}

function fill(mobile = "٠٩١٢-٠٠٠ ٠٠٠٠", password = "  exact new password  ") {
  fireEvent.change(screen.getByLabelText(en.mobile), {
    target: { value: mobile },
  });
  fireEvent.change(screen.getByLabelText(en.otp), {
    target: { value: " ١۲٣۴٥۶ " },
  });
  fireEvent.change(screen.getByLabelText(en.newPassword), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(en.confirmPassword), {
    target: { value: password },
  });
}

beforeEach(() => router.replace.mockReset());

describe("recovery form", () => {
  it("rejects an invalid mobile and unmatched confirmation without a request", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(anonymous()));
    await mount(fetch);
    fill("bad mobile");
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    fireEvent.submit(screen.getByTestId("recovery-form"));
    expect(screen.getByRole("alert").textContent).toContain(en.mobileInvalid);
    expect(fetch).toHaveBeenCalledOnce();
    fill("09120000000");
    fireEvent.change(screen.getByLabelText(en.confirmPassword), {
      target: { value: "different" },
    });
    fireEvent.submit(screen.getByTestId("recovery-form"));
    expect(screen.getByRole("alert").textContent).toContain(
      en.passwordMismatch,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole("link", { name: en.authBackToLogin })
        .getAttribute("href"),
    ).toBe("/login");
  });

  it("sends one normalized reset while preserving exact password whitespace and its success destination", async () => {
    const pending = deferred();
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) =>
        path === "/api/account/me"
          ? Promise.resolve(anonymous())
          : pending.promise,
    );
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("recovery-form"));
    fireEvent.submit(screen.getByTestId("recovery-form"));
    const requests = fetch.mock.calls.filter(
      ([path]) => path === "/api/auth/forgot-password",
    );
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0][1].body as string)).toEqual({
      mobile: "09120000000",
      otp: "123456",
      password: "  exact new password  ",
    });
    expect(
      (
        screen.getByRole("button", { name: en.pending }) as HTMLButtonElement
      ).closest("fieldset")?.disabled,
    ).toBe(true);
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/login?reset=success",
    );
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/account/me"),
    ).toHaveLength(1);
  });

  it("keeps a failed reset retryable with its current input", async () => {
    let resets = 0;
    const fetch = vi.fn((path: string) => {
      if (path === "/api/account/me") return Promise.resolve(anonymous());
      resets += 1;
      return Promise.resolve(
        resets === 1
          ? Response.json({ message: "Incorrect code" }, { status: 400 })
          : new Response(null, { status: 204 }),
      );
    });
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("recovery-form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Incorrect code"),
    );
    expect(
      (screen.getByLabelText(en.newPassword) as HTMLInputElement).value,
    ).toBe("  exact new password  ");
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByTestId("recovery-form"));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/login?reset=success"),
    );
    expect(resets).toBe(2);
  });

  it("requests the recovery purpose and discards a code result for an edited mobile", async () => {
    const pending = deferred();
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) =>
        path === "/api/account/me"
          ? Promise.resolve(anonymous())
          : pending.promise,
    );
    await mount(fetch);
    fill();
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    fireEvent.submit(screen.getByTestId("recovery-form"));
    const requests = fetch.mock.calls.filter(
      ([path]) => path === "/api/auth/otp-request",
    );
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0][1].body as string)).toEqual({
      mobile: "09120000000",
      purpose: "forgot_password",
    });
    fireEvent.change(screen.getByLabelText(en.mobile), {
      target: { value: "09121111111" },
    });
    await act(async () =>
      pending.resolve(
        Response.json({ expires_in: 120, remaining_seconds: 60 }),
      ),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (screen.getByRole("button", { name: en.sendCode }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("ignores a late successful reset after the authoritative locale changes", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const { rerender } = await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("recovery-form"));
    rerender(
      <FeatureTestProvider locale="fa">
        <SessionProbe />
        <Recovery />
      </FeatureTestProvider>,
    );
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).not.toHaveBeenCalled();
    expect(
      (
        screen
          .getByTestId("recovery-form")
          .querySelector('[name="password"]') as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("ignores reset errors after unmount rather than navigating or updating a later form", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const { unmount } = await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("recovery-form"));
    unmount();
    await act(async () => pending.reject(new TypeError("Late reset failure")));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
