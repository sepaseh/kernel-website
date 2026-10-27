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

import { Register } from "./Register";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
// Framework navigation is a boundary mock; HTTP, catalogs and session are real.
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const anonymous = () =>
  Response.json({ message: "No session" }, { status: 401 });
const otp = () => Response.json({ expires_in: 120, remaining_seconds: 1 });
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
      <Register />
    </FeatureTestProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("session ready").textContent).toBe("ready"),
  );
  return view;
}

function fill(mobile = "۰۹۱۲-۰۰۰ ۰۰۰۰", password = "  unchanged password  ") {
  fireEvent.change(screen.getByLabelText(en.firstName), {
    target: { value: "  Ada  " },
  });
  fireEvent.change(screen.getByLabelText(en.lastName), {
    target: { value: "  Lovelace  " },
  });
  fireEvent.change(screen.getByLabelText(en.mobile), {
    target: { value: mobile },
  });
  fireEvent.change(screen.getByLabelText(en.otp), {
    target: { value: " ۱۲٣۴۵٦ " },
  });
  fireEvent.change(screen.getByLabelText(en.password), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(en.confirmPassword), {
    target: { value: password },
  });
}

beforeEach(() => router.replace.mockReset());

describe("registration form", () => {
  it("validates mobile and matching passwords without sending malformed operations", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(anonymous()));
    await mount(fetch);
    fill("123");
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    expect(screen.getByRole("alert").textContent).toContain(en.mobileInvalid);
    fireEvent.submit(screen.getByTestId("register-form"));
    expect(fetch).toHaveBeenCalledOnce();
    fill("09120000000");
    fireEvent.change(screen.getByLabelText(en.confirmPassword), {
      target: { value: "different password" },
    });
    fireEvent.submit(screen.getByTestId("register-form"));
    expect(screen.getByRole("alert").textContent).toContain(
      en.passwordMismatch,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(
      (screen.getByLabelText(en.firstName) as HTMLInputElement).maxLength,
    ).toBe(1000);
    expect(
      screen.getByRole("link", { name: en.login }).getAttribute("href"),
    ).toBe("/login");
  });

  it("normalizes the code destination and blocks overlap until its cooldown expires", async () => {
    const pending = deferred();
    let codes = 0;
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) => {
        if (path === "/api/account/me") return Promise.resolve(anonymous());
        codes += 1;
        return codes === 1 ? pending.promise : Promise.resolve(otp());
      },
    );
    await mount(fetch);
    vi.useFakeTimers();
    fill();
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    fireEvent.submit(screen.getByTestId("register-form"));
    expect(codes).toBe(1);
    expect(
      JSON.parse(
        fetch.mock.calls.find(([path]) => path === "/api/auth/otp-request")![1]
          .body as string,
      ),
    ).toEqual({ mobile: "09120000000", purpose: "register" });
    await act(async () => pending.resolve(otp()));
    expect(screen.getByRole("status").textContent).toContain(en.codeRequested);
    const resend = screen.getByRole("button", {
      name: "Resend in 1s",
    }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    fireEvent.click(resend);
    expect(codes).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: en.sendCode })),
    );
    expect(codes).toBe(2);
  });

  it("does not associate a late code response or cooldown with an edited mobile", async () => {
    const first = deferred();
    let codes = 0;
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) => {
        if (path === "/api/account/me") return Promise.resolve(anonymous());
        codes += 1;
        return codes === 1 ? first.promise : Promise.resolve(otp());
      },
    );
    await mount(fetch);
    fill("09120000000");
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    fireEvent.change(screen.getByLabelText(en.mobile), {
      target: { value: "09121111111" },
    });
    await act(async () => first.resolve(otp()));
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (screen.getByRole("button", { name: en.sendCode }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: en.sendCode })),
    );
    const requests = fetch.mock.calls.filter(
      ([path]) => path === "/api/auth/otp-request",
    );
    expect(JSON.parse(requests[1][1].body as string).mobile).toBe(
      "09121111111",
    );
    expect(screen.getByRole("status").textContent).toContain(en.codeRequested);
    fireEvent.change(screen.getByLabelText(en.mobile), {
      target: { value: "09122222222" },
    });
    expect(
      (screen.getByRole("button", { name: en.sendCode }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("keeps code errors retryable and ignores a failure for a no-longer-visible destination", async () => {
    const pending = deferred();
    let codes = 0;
    const fetch = vi.fn((path: string) => {
      if (path === "/api/account/me") return Promise.resolve(anonymous());
      codes += 1;
      return codes === 1
        ? Promise.reject(new TypeError("Offline"))
        : pending.promise;
    });
    await mount(fetch);
    fill("09120000000");
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(en.networkError),
    );
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    fireEvent.change(screen.getByLabelText(en.mobile), {
      target: { value: "09121111111" },
    });
    await act(async () => pending.reject(new Error("Old destination failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      (screen.getByRole("button", { name: en.sendCode }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("submits a trimmed profile and normalized OTP while preserving the exact password", async () => {
    const pending = deferred();
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) =>
        path === "/api/account/me"
          ? Promise.resolve(anonymous())
          : pending.promise,
    );
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("register-form"));
    fireEvent.submit(screen.getByTestId("register-form"));
    const requests = fetch.mock.calls.filter(
      ([path]) => path === "/api/auth/register",
    );
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0][1].body as string)).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      mobile: "09120000000",
      otp: "123456",
      password: "  unchanged password  ",
    });
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/account");
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/account/me"),
    ).toHaveLength(2);
  });

  it("preserves input and a public 401 registration error without replacing its anonymous session", async () => {
    let attempts = 0;
    const fetch = vi.fn((path: string) => {
      if (path === "/api/account/me") return Promise.resolve(anonymous());
      attempts += 1;
      return Promise.resolve(
        attempts === 1
          ? Response.json({ message: "Invalid code" }, { status: 401 })
          : new Response(null, { status: 204 }),
      );
    });
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("register-form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Invalid code"),
    );
    expect((screen.getByLabelText(en.password) as HTMLInputElement).value).toBe(
      "  unchanged password  ",
    );
    fireEvent.submit(screen.getByTestId("register-form"));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/account"),
    );
    expect(attempts).toBe(2);
  });

  it.each(["code", "registration"])(
    "invalidates pending %s when a new session read starts",
    async (operation) => {
      const pending = deferred();
      const replacementRead = deferred();
      let reads = 0;
      const fetch = vi.fn((path: string) => {
        if (path !== "/api/account/me") return pending.promise;
        reads += 1;
        return reads === 1
          ? Promise.resolve(anonymous())
          : replacementRead.promise;
      });
      await mount(fetch);
      fill();
      if (operation === "code")
        fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
      else fireEvent.submit(screen.getByTestId("register-form"));
      act(() => window.dispatchEvent(new Event("kernel:session-expired")));
      expect(screen.getByLabelText("session ready").textContent).toBe(
        "loading",
      );
      await act(async () =>
        pending.resolve(
          operation === "code" ? otp() : new Response(null, { status: 204 }),
        ),
      );
      expect(screen.queryByRole("status")).toBeNull();
      expect(router.replace).not.toHaveBeenCalled();
      expect((screen.getByLabelText(en.mobile) as HTMLInputElement).value).toBe(
        "",
      );
      await act(async () => replacementRead.resolve(anonymous()));
      expect(screen.getByLabelText("session ready").textContent).toBe("ready");
    },
  );

  it("ignores a previous locale's completed code request", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const { rerender } = await mount(fetch);
    fill();
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    rerender(
      <FeatureTestProvider locale="fa">
        <SessionProbe />
        <Register />
      </FeatureTestProvider>,
    );
    await act(async () => pending.resolve(otp()));
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (
        screen
          .getByTestId("register-form")
          .querySelector('[name="mobile"]') as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("ignores late registration success and code failure after their form unmounts", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const first = await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("register-form"));
    first.unmount();
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).not.toHaveBeenCalled();
    const code = deferred();
    fetch.mockImplementation((path: string) =>
      path === "/api/account/me" ? Promise.resolve(anonymous()) : code.promise,
    );
    const second = await mount(fetch);
    fill();
    fireEvent.click(screen.getByRole("button", { name: en.sendCode }));
    second.unmount();
    await act(async () => code.reject(new Error("Late code failure")));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
