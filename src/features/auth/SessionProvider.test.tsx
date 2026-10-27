// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/shared/contracts";
import { TestIntlProvider } from "@/test/intl";

import { SessionProvider, useSession } from "./SessionProvider";

const account = (id: string): Account => ({
  id,
  first_name: "Ada",
  last_name: "Lovelace",
  mobile: "09120000000",
  is_system_admin: false,
  permissions: [],
  status: "active",
});
const deferred = () => {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function Root({ children }: { children?: ReactNode }) {
  return (
    <TestIntlProvider>
      <SessionProvider>{children}</SessionProvider>
    </TestIntlProvider>
  );
}

describe("session ownership", () => {
  it("requires a provider", () => {
    expect(() => renderHook(() => useSession())).toThrow(
      "The session provider is missing.",
    );
  });

  it("loads an account through the real HTTP client and supports accepted mutations", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(account("original")));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSession(), { wrapper: Root });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.account?.id).toBe("original"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/account/me",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
    act(() => result.current.acceptAccount(account("updated")));
    expect(result.current.account?.id).toBe("updated");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("keeps 401 as an anonymous session but exposes a real failure and permits retry", async () => {
    const failure = new TypeError("Synthetic offline");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "No session" }, { status: 401 }),
      )
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(Response.json(account("retried")));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSession(), { wrapper: Root });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.account).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.loading).toBe(false);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.account?.id).toBe("retried"));
    expect(result.current.error).toBeUndefined();
  });

  it("invalidates late reads and old mutation callbacks when a newer session is refreshed", async () => {
    const first = deferred(),
      second = deferred();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        signals.push(init.signal);
        return signals.length === 1 ? first.promise : second.promise;
      }),
    );
    const { result } = renderHook(() => useSession(), { wrapper: Root });
    const staleAccept = result.current.acceptAccount;
    act(() => window.dispatchEvent(new Event("kernel:session-expired")));
    expect(signals[0].aborted).toBe(true);
    await act(async () => {
      second.resolve(Response.json(account("new-session")));
    });
    expect(result.current.account?.id).toBe("new-session");
    await act(async () => {
      first.resolve(Response.json(account("obsolete")));
    });
    act(() => staleAccept(account("old-mutation")));
    expect(result.current.account?.id).toBe("new-session");
  });

  it("ignores late failures and removes the session event listener on unmount", async () => {
    const pending = deferred();
    const add = vi.spyOn(window, "addEventListener"),
      remove = vi.spyOn(window, "removeEventListener");
    const fetch = vi.fn((_url, init) => {
      expect(init.signal.aborted).toBe(false);
      return pending.promise;
    });
    vi.stubGlobal("fetch", fetch);
    const { unmount } = renderHook(() => useSession(), { wrapper: Root });
    const subscription = add.mock.calls.find(
      ([type]) => type === "kernel:session-expired",
    )!;
    unmount();
    expect(remove).toHaveBeenCalledWith(
      "kernel:session-expired",
      subscription[1],
    );
    await act(async () => pending.reject(new Error("Late synthetic failure")));
    act(() => window.dispatchEvent(new Event("kernel:session-expired")));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("aborts the replayed StrictMode request and accepts only its live request", async () => {
    const reads: ReturnType<typeof deferred>[] = [],
      signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        const read = deferred();
        reads.push(read);
        signals.push(init.signal);
        return read.promise;
      }),
    );
    const { result, unmount } = renderHook(() => useSession(), {
      wrapper: Root,
      reactStrictMode: true,
    });
    expect(reads).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    await act(async () => {
      reads[1].resolve(Response.json(account("live")));
    });
    await act(async () => {
      reads[0].resolve(Response.json(account("replayed")));
    });
    expect(result.current.account?.id).toBe("live");
    unmount();
    expect(signals[1].aborted).toBe(true);
  });

  it("reloads using the authoritative provider locale and hides a prior locale snapshot", async () => {
    let locale: "en" | "fa" = "en";
    const next = deferred();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(account("english")))
      .mockReturnValueOnce(next.promise);
    vi.stubGlobal("fetch", fetch);
    const wrapper = ({ children }: { children?: ReactNode }) => (
      <TestIntlProvider locale={locale}>
        <SessionProvider>{children}</SessionProvider>
      </TestIntlProvider>
    );
    const { result, rerender } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.account?.id).toBe("english"));
    locale = "fa";
    rerender();
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeUndefined();
    const headers = fetch.mock.calls[1][1].headers as Headers;
    expect(headers.get("Accept-Language")).toBe("fa");
    await act(async () => next.resolve(Response.json(account("persian"))));
    expect(result.current.account?.id).toBe("persian");
  });

  it("gives a returning locale a new generation and rejects its original mutation callback", async () => {
    let locale: "en" | "fa" = "en";
    const persian = deferred(),
      returningEnglish = deferred();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(account("original-english")))
      .mockReturnValueOnce(persian.promise)
      .mockReturnValueOnce(returningEnglish.promise);
    vi.stubGlobal("fetch", fetch);
    const wrapper = ({ children }: { children?: ReactNode }) => (
      <TestIntlProvider locale={locale}>
        <SessionProvider>{children}</SessionProvider>
      </TestIntlProvider>
    );
    const { result, rerender } = renderHook(() => useSession(), { wrapper });
    await waitFor(() =>
      expect(result.current.account?.id).toBe("original-english"),
    );
    const staleAccept = result.current.acceptAccount;

    locale = "fa";
    rerender();
    locale = "en";
    rerender();
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeUndefined();
    await act(async () =>
      returningEnglish.resolve(Response.json(account("returning-english"))),
    );
    expect(result.current.account?.id).toBe("returning-english");

    act(() => staleAccept(account("obsolete-mutation")));
    await act(async () =>
      persian.resolve(Response.json(account("obsolete-persian"))),
    );
    expect(result.current.account?.id).toBe("returning-english");
  });
});
