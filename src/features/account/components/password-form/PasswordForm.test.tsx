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
import { replaceDocument } from "@/shared/navigation/document";
import { accountFixture, FeatureTestProvider } from "@/test/feature-session";

import { PasswordForm } from "./PasswordForm";

vi.mock("@/shared/navigation/document", () => ({ replaceDocument: vi.fn() }));

function View() {
  const { account, refresh } = useSession();
  return (
    <>
      {account ? <PasswordForm /> : null}
      <button type="button" onClick={refresh}>
        Reload session
      </button>
    </>
  );
}
function setup(write: (init: RequestInit) => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init: RequestInit) =>
      path === "/api/account/me"
        ? Promise.resolve(Response.json(accountFixture()))
        : write(init),
    ),
  );
  render(
    <FeatureTestProvider scope="account">
      <View />
    </FeatureTestProvider>,
  );
}
function fill(password = "  secret value  ", confirmation = password) {
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "  current value  " },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmation },
  });
}

describe("password change ownership", () => {
  it("preserves exact password whitespace and starts a new document after success", async () => {
    const writes: RequestInit[] = [];
    let resolve!: (response: Response) => void;
    setup((init) => {
      writes.push(init);
      return new Promise<Response>((yes) => {
        resolve = yes;
      });
    });
    await screen.findByLabelText("Current password");
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(writes).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Please wait…" }).matches(":disabled"),
    ).toBe(true);
    expect(replaceDocument).not.toHaveBeenCalled();
    expect(JSON.parse(String(writes[0].body))).toEqual({
      current_password: "  current value  ",
      new_password: "  secret value  ",
    });
    await act(async () => resolve(new Response(null, { status: 204 })));
    await waitFor(() =>
      expect(replaceDocument).toHaveBeenCalledExactlyOnceWith(
        "/login?password=changed",
      ),
    );
  });

  it("rejects a mismatched confirmation without sending a request", async () => {
    const write = vi.fn(async () => new Response(null, { status: 204 }));
    setup(write);
    await screen.findByLabelText("Current password");
    fill("first password", "other password");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("match");
    expect(replaceDocument).not.toHaveBeenCalled();
  });

  it("preserves values and permits retry after a failed pending write", async () => {
    let resolve!: (response: Response) => void;
    const write = vi.fn(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
    );
    setup(write);
    await screen.findByLabelText("Current password");
    fill();
    const save = screen.getByRole("button", { name: "Change password" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(write).toHaveBeenCalledOnce();
    await act(async () =>
      resolve(
        Response.json(
          { message: "Current password rejected" },
          { status: 400 },
        ),
      ),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Current password rejected",
    );
    expect(
      (screen.getByLabelText("New password") as HTMLInputElement).value,
    ).toBe("  secret value  ");
    expect(replaceDocument).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("cannot navigate after its session was replaced while the write was pending", async () => {
    let resolve!: (response: Response) => void;
    setup(
      () =>
        new Promise<Response>((yes) => {
          resolve = yes;
        }),
    );
    await screen.findByLabelText("Current password");
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload session" }));
    await screen.findByLabelText("Current password");
    await act(async () => resolve(new Response(null, { status: 204 })));
    expect(replaceDocument).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("New password") as HTMLInputElement).value,
    ).toBe("");
  });
});
