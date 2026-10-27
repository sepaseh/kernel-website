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

import { ProfileForm } from "./ProfileForm";

function View() {
  const { account, refresh } = useSession();
  return (
    <>
      {account ? <ProfileForm account={account} /> : null}
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
  const fetch = vi.fn((path: string, init: RequestInit) =>
    path === "/api/account/me"
      ? Promise.resolve(Response.json(read()))
      : write(init),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <FeatureTestProvider scope="account">
      <View />
    </FeatureTestProvider>,
  );
  return fetch;
}
const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;

describe("profile form ownership", () => {
  it("sends trimmed names and displays the normalized account returned by the API", async () => {
    const writes: RequestInit[] = [];
    setup(async (init) => {
      writes.push(init);
      return Response.json(
        accountFixture({ first_name: "Grace", last_name: "Hopper" }),
      );
    });
    await screen.findByLabelText("First name");
    expect(field("Mobile number").readOnly).toBe(true);
    expect(field("First name").maxLength).toBe(1000);
    fireEvent.change(field("First name"), { target: { value: "  Grace  " } });
    fireEvent.change(field("Last name"), { target: { value: "  Hopper  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByRole("status");
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("PATCH");
    expect(JSON.parse(String(writes[0].body))).toEqual({
      first_name: "Grace",
      last_name: "Hopper",
    });
    expect(field("First name").value).toBe("Grace");
    expect(field("Last name").value).toBe("Hopper");
  });

  it("retains entered values after failure and prevents duplicate writes while pending", async () => {
    let resolve!: (value: Response) => void;
    const write = vi.fn(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
    );
    setup(write);
    await screen.findByLabelText("First name");
    fireEvent.change(field("First name"), {
      target: { value: "Unchanged draft" },
    });
    const save = screen.getByRole("button", { name: "Save profile" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(write).toHaveBeenCalledOnce();
    await act(async () =>
      resolve(Response.json({ message: "Name rejected" }, { status: 400 })),
    );
    expect(screen.getByRole("alert").textContent).toContain("Name rejected");
    expect(field("First name").value).toBe("Unchanged draft");
    expect(field("First name").disabled).toBe(false);
  });

  it("does not write an invalid required name", async () => {
    const write = vi.fn(async () => Response.json(accountFixture()));
    setup(write);
    await screen.findByLabelText("First name");
    fireEvent.change(field("First name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(write).not.toHaveBeenCalled();
  });

  it("cannot install an old profile response after a replacement session loads", async () => {
    let current: Account = accountFixture();
    let resolve!: (value: Response) => void;
    setup(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
      () => current,
    );
    await screen.findByLabelText("First name");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    current = accountFixture({ id: "replacement", first_name: "Katherine" });
    fireEvent.click(screen.getByRole("button", { name: "Reload session" }));
    await waitFor(() => expect(field("First name").value).toBe("Katherine"));
    await act(async () =>
      resolve(Response.json(accountFixture({ first_name: "Obsolete" }))),
    );
    expect(field("First name").value).toBe("Katherine");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
