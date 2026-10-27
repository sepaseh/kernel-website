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
import { accountFixture, FeatureTestProvider } from "@/test/feature-session";

import { Login } from "./Login";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
// Router transitions need the later Next.js application; HTTP and session stay real.
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function SessionProbe() {
  const session = useSession();
  return (
    <span aria-label="session state">
      {session.loading ? "loading" : (session.account?.id ?? "anonymous")}
    </span>
  );
}

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

async function mount(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <FeatureTestProvider>
      <SessionProbe />
      <Login />
    </FeatureTestProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("session state").textContent).toBe(
      "anonymous",
    ),
  );
  return view;
}

function fill(mobile = "۰۹۱۲-۰۰۰ ۰۰۰۰", password = "  secret password  ") {
  fireEvent.change(screen.getByLabelText(en.mobile), {
    target: { value: mobile },
  });
  fireEvent.change(screen.getByLabelText(en.password), {
    target: { value: password },
  });
}

beforeEach(() => router.replace.mockReset());

describe("login form ownership", () => {
  it("validates mobile before making an authentication request", async () => {
    const fetch = vi.fn().mockResolvedValue(anonymous());
    await mount(fetch);
    fill("123");
    fireEvent.submit(screen.getByTestId("login-form"));
    expect(screen.getByRole("alert").textContent).toContain(en.mobileInvalid);
    expect(fetch).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("link", { name: en.forgotPassword })
        .getAttribute("href"),
    ).toBe("/forgot-password");
    expect(
      screen.getByRole("link", { name: en.register }).getAttribute("href"),
    ).toBe("/register");
  });

  it("normalizes mobile, preserves the password and refreshes the real session before navigation", async () => {
    const pending = deferred();
    const fetch = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(
      (path) =>
        path === "/api/account/me"
          ? Promise.resolve(anonymous())
          : pending.promise,
    );
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    fireEvent.submit(screen.getByTestId("login-form"));
    expect(screen.getByTestId("login-form").getAttribute("aria-busy")).toBe(
      "true",
    );
    const requests = fetch.mock.calls.filter(
      ([path]) => path === "/api/auth/login",
    );
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0][1].body as string)).toEqual({
      identifier: "09120000000",
      password: "  secret password  ",
    });
    expect(requests[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    );
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/account");
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/account/me"),
    ).toHaveLength(2);
  });

  it("retains input and its own public 401 error without replacing the anonymous session, then permits retry", async () => {
    let attempts = 0;
    const fetch = vi.fn((path: string) => {
      if (path === "/api/account/me") return Promise.resolve(anonymous());
      attempts += 1;
      return Promise.resolve(
        attempts === 1
          ? Response.json({ message: "Credentials rejected" }, { status: 401 })
          : new Response(null, { status: 204 }),
      );
    });
    await mount(fetch);
    fill("09120000000", " untouched ");
    fireEvent.submit(screen.getByTestId("login-form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Credentials rejected",
      ),
    );
    expect((screen.getByLabelText(en.password) as HTMLInputElement).value).toBe(
      " untouched ",
    );
    expect((screen.getByLabelText(en.mobile) as HTMLInputElement).value).toBe(
      "09120000000",
    );
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/account/me"),
    ).toHaveLength(1);
    expect(screen.getByTestId("login-form").getAttribute("aria-busy")).toBe(
      "false",
    );
    fireEvent.submit(screen.getByTestId("login-form"));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/account"),
    );
    expect(attempts).toBe(2);
  });

  it("renders a transport failure without losing values or blocking a retry", async () => {
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : Promise.reject(new TypeError("Synthetic offline")),
    );
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(en.networkError),
    );
    expect((screen.getByLabelText(en.password) as HTMLInputElement).value).toBe(
      "  secret password  ",
    );
    expect(
      (screen.getByRole("button", { name: en.login }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("ignores a late authentication success after the locale owner changes", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const { rerender } = await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    rerender(
      <FeatureTestProvider locale="fa">
        <SessionProbe />
        <Login />
      </FeatureTestProvider>,
    );
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).not.toHaveBeenCalled();
    expect(
      (
        screen
          .getByTestId("login-form")
          .querySelector('[name="password"]') as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("ignores the earlier form's result after another account has replaced its session", async () => {
    const pending = deferred();
    let reads = 0;
    const fetch = vi.fn((path: string) => {
      if (path !== "/api/account/me") return pending.promise;
      reads += 1;
      return Promise.resolve(
        reads === 1
          ? anonymous()
          : Response.json(accountFixture({ id: "new-session" })),
      );
    });
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    act(() => window.dispatchEvent(new Event("kernel:session-expired")));
    await waitFor(() =>
      expect(screen.getByLabelText("session state").textContent).toBe(
        "new-session",
      ),
    );
    await act(async () => pending.resolve(new Response(null, { status: 204 })));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("session state").textContent).toBe(
      "new-session",
    );
  });

  it("invalidates a pending login as soon as a newer session read starts", async () => {
    const authentication = deferred();
    const replacementRead = deferred();
    let reads = 0;
    const fetch = vi.fn((path: string) => {
      if (path !== "/api/account/me") return authentication.promise;
      reads += 1;
      return reads === 1
        ? Promise.resolve(anonymous())
        : replacementRead.promise;
    });
    await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    act(() => window.dispatchEvent(new Event("kernel:session-expired")));
    expect(screen.getByLabelText("session state").textContent).toBe("loading");
    await act(async () =>
      authentication.resolve(new Response(null, { status: 204 })),
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect((screen.getByLabelText(en.password) as HTMLInputElement).value).toBe(
      "",
    );
    await act(async () =>
      replacementRead.resolve(
        Response.json(accountFixture({ id: "replacement" })),
      ),
    );
    expect(screen.getByLabelText("session state").textContent).toBe(
      "replacement",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not navigate or update after the form unmounts", async () => {
    const pending = deferred();
    const fetch = vi.fn((path: string) =>
      path === "/api/account/me"
        ? Promise.resolve(anonymous())
        : pending.promise,
    );
    const { unmount } = await mount(fetch);
    fill();
    fireEvent.submit(screen.getByTestId("login-form"));
    unmount();
    await act(async () => pending.reject(new Error("Late failure")));
    expect(router.replace).not.toHaveBeenCalled();
  });
});
