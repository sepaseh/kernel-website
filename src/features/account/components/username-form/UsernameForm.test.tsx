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

import { UsernameForm } from "./UsernameForm";

function View() {
  const { account, refresh } = useSession();
  return (
    <>
      {account ? <UsernameForm account={account} /> : null}
      <button type="button" onClick={refresh}>
        Reload session
      </button>
    </>
  );
}
function setup(
  write: (init: RequestInit) => Promise<Response>,
  read = () => accountFixture(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init: RequestInit) =>
      path === "/api/account/me"
        ? Promise.resolve(Response.json(read()))
        : write(init),
    ),
  );
  render(
    <FeatureTestProvider scope="account">
      <View />
    </FeatureTestProvider>,
  );
}
const input = () => screen.getByLabelText("Username") as HTMLInputElement;

describe("username form ownership", () => {
  it("normalizes valid casing and displays the server result", async () => {
    const writes: RequestInit[] = [];
    setup(async (init) => {
      writes.push(init);
      return Response.json(accountFixture({ username: "new.user" }));
    });
    await screen.findByLabelText("Username");
    expect(input().minLength).toBe(3);
    expect(input().maxLength).toBe(30);
    fireEvent.change(input(), { target: { value: "New.USER" } });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));
    await screen.findByRole("status");
    expect(JSON.parse(String(writes[0].body))).toEqual({
      username: "new.user",
    });
    expect(input().value).toBe("new.user");
  });

  it("rejects a native pattern violation without writing", async () => {
    const write = vi.fn(async () => Response.json(accountFixture()));
    setup(write);
    await screen.findByLabelText("Username");
    fireEvent.change(input(), { target: { value: "invalid!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps a failed draft retryable and blocks a duplicate pending write", async () => {
    let resolve!: (value: Response) => void;
    const write = vi.fn(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
    );
    setup(write);
    await screen.findByLabelText("Username");
    fireEvent.change(input(), { target: { value: "draft.user" } });
    const save = screen.getByRole("button", { name: "Save username" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(write).toHaveBeenCalledOnce();
    await act(async () =>
      resolve(Response.json({ message: "Already taken" }, { status: 409 })),
    );
    expect(screen.getByRole("alert").textContent).toContain("Already taken");
    expect(input().value).toBe("draft.user");
    expect(input().disabled).toBe(false);
  });

  it("ignores an old write when another session replaces the form", async () => {
    let current: Account = accountFixture();
    let resolve!: (value: Response) => void;
    setup(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
      () => current,
    );
    await screen.findByLabelText("Username");
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));
    current = accountFixture({ id: "next-account", username: "new.owner" });
    fireEvent.click(screen.getByRole("button", { name: "Reload session" }));
    await waitFor(() => expect(input().value).toBe("new.owner"));
    await act(async () =>
      resolve(Response.json(accountFixture({ username: "old.owner" }))),
    );
    expect(input().value).toBe("new.owner");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
