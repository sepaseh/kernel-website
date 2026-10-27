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
import type { Account } from "@/shared/contracts";
import { accountFixture, FeatureTestProvider } from "@/test/feature-session";

import { EmailForm } from "./EmailForm";

function View() {
  const { account, refresh } = useSession();
  return (
    <>
      {account ? <EmailForm account={account} /> : null}
      <button type="button" onClick={refresh}>
        Reload session
      </button>
    </>
  );
}
function setup(
  write: (path: string, init: RequestInit) => Promise<Response>,
  read = () => accountFixture(),
) {
  const fetch = vi.fn((path: string, init: RequestInit) =>
    path === "/api/account/me"
      ? Promise.resolve(Response.json(read()))
      : write(path, init),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <FeatureTestProvider scope="account">
      <View />
    </FeatureTestProvider>,
  );
  return fetch;
}
const email = () => screen.getByLabelText("Email") as HTMLInputElement;
const otp = () =>
  screen.getByLabelText("Verification code") as HTMLInputElement;
const cooldown = () => Response.json({ expires_in: 120, remaining_seconds: 1 });

describe("email verification ownership", () => {
  it("validates and normalizes its destination, normalizes OTP digits and reloads the accepted account", async () => {
    let current = accountFixture();
    const writes: { path: string; init: RequestInit }[] = [];
    setup(
      async (path, init) => {
        writes.push({ path, init });
        if (path.endsWith("request-email-verification")) return cooldown();
        current = accountFixture({ email: "new@example.test" });
        return new Response(null, { status: 204 });
      },
      () => current,
    );
    await screen.findByLabelText("Email");
    fireEvent.change(email(), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(writes).toHaveLength(0);
    fireEvent.change(email(), { target: { value: " New@Example.Test " } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByText("Verification code requested.");
    expect(JSON.parse(String(writes[0].init.body))).toEqual({
      email: "new@example.test",
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Resend in 1s",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(otp(), { target: { value: "۱۲٣۴۵۶" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await screen.findByText("Your email address has been verified.");
    expect(JSON.parse(String(writes[1].init.body))).toEqual({
      email: "new@example.test",
      otp: "123456",
    });
    expect(email().value).toBe("new@example.test");
    expect(screen.getByText("Verified email: new@example.test")).toBeDefined();
  });

  it("invalidates a requested code when the destination is edited and respects resend cooldown", async () => {
    const writes: RequestInit[] = [];
    const write = vi.fn(async (_path: string, init: RequestInit) => {
      writes.push(init);
      return cooldown();
    });
    setup(write);
    await screen.findByLabelText("Email");
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Send code" })),
    );
    await screen.findByText("Verification code requested.");
    expect(
      (
        screen.getByRole("button", {
          name: "Verify email",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.change(email(), { target: { value: "other@example.test" } });
    expect(
      (
        screen.getByRole("button", {
          name: "Verify email",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resend in 1s" }));
    expect(write).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(1000));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Send code" })),
    );
    await screen.findByText("Verification code requested.");
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(writes[1].body))).toEqual({
      email: "other@example.test",
    });
  });

  it("cannot attach a delayed code response to an edited destination", async () => {
    let resolve!: (response: Response) => void;
    const write = vi.fn(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
    );
    setup(write);
    await screen.findByLabelText("Email");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(email(), { target: { value: "edited@example.test" } });
    await act(async () => resolve(cooldown()));
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Verify email",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Send code" })).toBeDefined();
  });

  it("keeps failed sends and verification retryable without losing entered values", async () => {
    let sends = 0;
    setup(async (path) => {
      if (!path.endsWith("request-email-verification"))
        return Response.json({ message: "Code rejected" }, { status: 400 });
      sends += 1;
      return sends === 1
        ? Response.json({ message: "Try sending again" }, { status: 400 })
        : cooldown();
    });
    await screen.findByLabelText("Email");
    fireEvent.change(email(), { target: { value: "retry@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByText("Try sending again");
    expect(email().value).toBe("retry@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByText("Verification code requested.");
    fireEvent.change(otp(), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await screen.findByText("Code rejected");
    expect(email().value).toBe("retry@example.test");
    expect(otp().value).toBe("123456");
    expect(
      (
        screen.getByRole("button", {
          name: "Verify email",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("does not reload or announce an obsolete verification after the session changes", async () => {
    let current: Account = accountFixture();
    let resolve!: (response: Response) => void;
    const fetch = setup(
      async (path) =>
        path.endsWith("request-email-verification")
          ? cooldown()
          : new Promise<Response>((yes) => {
              resolve = yes;
            }),
      () => current,
    );
    await screen.findByLabelText("Email");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByText("Verification code requested.");
    fireEvent.change(otp(), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    current = accountFixture({
      id: "replacement",
      email: "replacement@example.test",
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload session" }));
    await waitFor(() => expect(email().value).toBe("replacement@example.test"));
    await act(async () => resolve(new Response(null, { status: 204 })));
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/account/me"),
    ).toHaveLength(2);
    expect(email().value).toBe("replacement@example.test");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("starts empty when the account has no email", async () => {
    setup(
      async () => cooldown(),
      () => accountFixture({ email: undefined }),
    );
    await screen.findByLabelText("Email");
    expect(email().value).toBe("");
    expect(screen.queryByText(/Verified email:/)).toBeNull();
  });
});
