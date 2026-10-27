// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSession } from "@/features/auth/SessionProvider";
import en from "@/i18n/catalog-data/locales/en";
import fa from "@/i18n/catalog-data/locales/fa";
import { accountFixture, FeatureTestProvider } from "@/test/feature-session";

import { Account } from "./Account";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
// Navigation is a framework boundary; session, HTTP, catalogs and controls are real.
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function deferred() {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

function SessionControls() {
  const { acceptAccount, refresh } = useSession();
  return (
    <>
      <button type="button" onClick={refresh}>
        Refresh synthetic session
      </button>
      <button
        type="button"
        onClick={() =>
          acceptAccount(
            accountFixture({ id: "second-account", first_name: "Bea" }),
          )
        }
      >
        Replace synthetic account
      </button>
    </>
  );
}

function renderAccount(locale: "en" | "fa" = "en", controls = false) {
  return render(
    <FeatureTestProvider locale={locale} scope="account">
      {controls ? <SessionControls /> : null}
      <Account />
    </FeatureTestProvider>,
  );
}

describe("account view ownership", () => {
  it("shows a pending account read before rendering the current account", async () => {
    const read = deferred();
    const fetch = vi.fn().mockReturnValue(read.promise);
    vi.stubGlobal("fetch", fetch);
    renderAccount();
    expect(screen.getByRole("status").textContent).toBe(
      en.accountSessionLoading,
    );
    await act(async () => read.resolve(Response.json(accountFixture())));
    expect(screen.getByTestId("account-content")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Ada",
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/me",
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
  });

  it("redirects an anonymous session rather than rendering private controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({}, { status: 401 })),
    );
    renderAccount();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByTestId("account-content")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a real loading failure visible and reloads only on explicit retry", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Synthetic offline"))
      .mockResolvedValueOnce(Response.json(accountFixture()));
    vi.stubGlobal("fetch", fetch);
    renderAccount();
    await screen.findByRole("heading", { name: en.accountSessionError });
    expect(screen.getByRole("alert").textContent).toContain(en.networkError);
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.accountCheckAgain }));
    await screen.findByTestId("account-content");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses only the scoped account catalog for translated controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(accountFixture())),
    );
    renderAccount("fa");
    await screen.findByRole("button", { name: fa.accountLogout });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Ada",
    );
    expect(screen.getByLabelText(fa.firstName)).toBeDefined();
  });

  it("prevents duplicate logout requests and moves to login after success", async () => {
    const signOut = deferred();
    let signedOut = false;
    const fetch = vi.fn((path: string) =>
      path === "/api/auth/logout"
        ? signOut.promise.then((response) => {
            signedOut = true;
            return response;
          })
        : Promise.resolve(
            signedOut
              ? Response.json({}, { status: 401 })
              : Response.json(accountFixture()),
          ),
    );
    vi.stubGlobal("fetch", fetch);
    renderAccount();
    const button = await screen.findByRole("button", {
      name: en.accountLogout,
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/auth/logout"),
    ).toHaveLength(1);
    await act(async () => signOut.resolve(new Response(null, { status: 204 })));
    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("account-content")).toBeNull();
    const call = fetch.mock.calls.find(([path]) => path === "/api/auth/logout");
    expect(call).toBeDefined();
  });

  it("retains the account and a retry path when logout fails", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/auth/logout") {
          attempts += 1;
          return Promise.reject(new TypeError("Synthetic logout failure"));
        }
        return Promise.resolve(Response.json(accountFixture()));
      }),
    );
    renderAccount();
    const button = await screen.findByRole("button", {
      name: en.accountLogout,
    });
    fireEvent.click(button);
    await screen.findByRole("alert");
    expect(screen.getByTestId("account-content")).toBeDefined();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(attempts).toBe(2));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("discards late logout completion after a newer session is loaded", async () => {
    const signOut = deferred();
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/auth/logout") return signOut.promise;
        reads += 1;
        return Promise.resolve(
          Response.json(
            accountFixture({ first_name: reads === 1 ? "Ada" : "Bea" }),
          ),
        );
      }),
    );
    renderAccount("en", true);
    fireEvent.click(
      await screen.findByRole("button", { name: en.accountLogout }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh synthetic session" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "Bea",
      ),
    );
    await act(async () => signOut.resolve(new Response(null, { status: 204 })));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("discards late logout failure after its account owner is replaced", async () => {
    const signOut = deferred();
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        path === "/api/auth/logout"
          ? signOut.promise
          : Promise.resolve(Response.json(accountFixture())),
      ),
    );
    renderAccount("en", true);
    fireEvent.click(
      await screen.findByRole("button", { name: en.accountLogout }),
    );
    const firstName = screen.getByLabelText(en.firstName) as HTMLInputElement;
    fireEvent.change(firstName, { target: { value: "Dirty prior account" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Replace synthetic account" }),
    );
    expect(
      (screen.getByLabelText(en.firstName) as HTMLInputElement).value,
    ).toBe("Bea");
    await act(async () => signOut.reject(new TypeError("Obsolete logout")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
