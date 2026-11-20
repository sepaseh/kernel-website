// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/catalog-data/locales/en.json";
import fa from "@/i18n/catalog-data/locales/fa.json";
import { selectClientMessages } from "@/i18n/client-messages";

import { ContactForm } from "./ContactForm";

const receipt = {
  id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-11-07T10:00:00.000Z",
};
const deferred = () => {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function tree(locale: "en" | "fa" = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={selectClientMessages(locale === "fa" ? fa : en, "contact")}
      timeZone="UTC"
    >
      <ContactForm />
    </NextIntlClientProvider>
  );
}
function fill(mobile = "۰۹۱۲۳۴۵۶۷۸۹", description = "  First\nSecond  ") {
  fireEvent.change(screen.getByLabelText(en.contactName), {
    target: { value: " Ada " },
  });
  fireEvent.change(screen.getByLabelText(en.contactMobile), {
    target: { value: mobile },
  });
  fireEvent.change(screen.getByLabelText(en.contactDescription), {
    target: { value: description },
  });
}
const submit = () =>
  fireEvent.submit(screen.getByRole("form", { name: en.contact }));
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(receipt, { status: 201 })),
  ),
);
afterEach(() => vi.unstubAllGlobals());

describe("three-field contact form ownership", () => {
  it("renders exactly three required controls with persistent labels and validates/focuses before HTTP", () => {
    render(tree());
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    submit();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText(en.contactName)).toBe(document.activeElement);
    expect(
      screen.getByLabelText(en.contactName).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.getByText(en.contactDescriptionInvalid)).toBeTruthy();
    expect(screen.getByLabelText(en.contactMobile).getAttribute("dir")).toBe(
      "ltr",
    );
  });
  it("serializes submission, retains inputs/key after uncertain failure and resets only after confirmed success", async () => {
    const first = deferred();
    const mock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(Response.json(receipt, { status: 201 }));
    vi.stubGlobal("fetch", mock);
    render(tree());
    fill();
    submit();
    submit();
    expect(mock).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(en.contactName).matches(":disabled")).toBe(
      true,
    );
    await act(async () =>
      first.reject(new TypeError("synthetic transport failure")),
    );
    expect(screen.getByRole("alert").textContent).toContain(en.networkError);
    expect(
      (screen.getByLabelText(en.contactDescription) as HTMLTextAreaElement)
        .value,
    ).toBe("  First\nSecond  ");
    fireEvent.change(screen.getByLabelText(en.contactMobile), {
      target: { value: "+989123456789" },
    });
    submit();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        en.contactSuccess,
      ),
    );
    expect(
      new Headers(mock.mock.calls[0][1].headers).get("idempotency-key"),
    ).toBe(new Headers(mock.mock.calls[1][1].headers).get("idempotency-key"));
    fireEvent.click(screen.getByRole("button", { name: en.contactAnother }));
    expect(
      (screen.getByLabelText(en.contactName) as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByLabelText(en.contactName)).toBe(document.activeElement);
    fill();
    submit();
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(3));
    expect(
      new Headers(mock.mock.calls[2][1].headers).get("idempotency-key"),
    ).not.toBe(
      new Headers(mock.mock.calls[1][1].headers).get("idempotency-key"),
    );
  });
  it("uses a new key for changed logical content and maps field errors after enabling controls", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { message: "Invalid input", cause: { mobile: "Rejected mobile" } },
          { status: 400 },
        ),
      )
      .mockResolvedValue(Response.json(receipt, { status: 201 }));
    vi.stubGlobal("fetch", mock);
    render(tree());
    fill();
    submit();
    await waitFor(() =>
      expect(screen.getByText("Rejected mobile")).toBeTruthy(),
    );
    await waitFor(() => {
      const mobile = screen.getByLabelText(en.contactMobile);
      expect(mobile.matches(":disabled")).toBe(false);
      expect(mobile).toBe(document.activeElement);
    });
    fill("09123456780");
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(
      new Headers(mock.mock.calls[0][1].headers).get("idempotency-key"),
    ).not.toBe(
      new Headers(mock.mock.calls[1][1].headers).get("idempotency-key"),
    );
  });
  it.each(["12", "invalid", "0"])(
    "shows quota guidance for Retry-After %s without clearing input",
    async (seconds) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { message: "Quota reached" },
              { status: 429, headers: { "Retry-After": seconds } },
            ),
          ),
      );
      render(tree());
      fill();
      submit();
      await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
      expect(screen.getByRole("alert").textContent).toContain(
        seconds === "12" ? "12 seconds" : "Quota reached",
      );
      expect(
        (screen.getByLabelText(en.contactName) as HTMLInputElement).value,
      ).toBe(" Ada ");
    },
  );
  it("ignores completion from an unmounted form and localizes all labels after locale replacement", async () => {
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const view = render(tree());
    fill();
    submit();
    view.rerender(tree("fa"));
    await act(async () =>
      pending.resolve(Response.json(receipt, { status: 201 })),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (screen.getByLabelText(fa.contactName) as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByRole("button", { name: fa.contactSend })).toBeTruthy();
  });
});
