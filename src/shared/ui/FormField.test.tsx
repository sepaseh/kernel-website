// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "./FormField";

describe("form field semantics", () => {
  it("links labels and generated unique descriptions even without a caller id/name", () => {
    render(
      <>
        <FormField label="First" hint="First hint" />
        <FormField label="Second" hint="Second hint" />
      </>,
    );
    const first = screen.getByLabelText("First");
    const second = screen.getByLabelText("Second");
    expect(first.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    expect(
      document.getElementById(first.getAttribute("aria-describedby")!),
    ).toHaveProperty("textContent", "First hint");
  });

  it("preserves an external description and forwards validation/native input props", () => {
    render(
      <>
        <p id="external">External help</p>
        <FormField
          id="email"
          name="email"
          label="Email"
          type="email"
          required
          disabled
          aria-describedby="external"
          hint="Hint"
          error="Invalid email"
        />
      </>,
    );
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.id).toBe("email");
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.type).toBe("email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "external",
      "email-description",
    ]);
    expect(screen.queryByText("Hint")).toBeNull();
    expect(screen.getByText("Invalid email").id).toBe("email-description");
  });

  it("keeps the form name independent of the generated id and has no invented description", () => {
    render(<FormField label="Username" name="username" />);
    const input = screen.getByLabelText("Username");
    expect(input.getAttribute("name")).toBe("username");
    expect(input.id).toBeTruthy();
    expect(input.id).not.toBe("username");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("keeps two controls with the same form name independently labeled and described", () => {
    render(
      <>
        <FormField
          label="First email"
          name="email"
          hint="First account email"
        />
        <FormField
          label="Second email"
          name="email"
          hint="Second account email"
        />
      </>,
    );
    const first = screen.getByLabelText("First email");
    const second = screen.getByLabelText("Second email");
    expect(first.id).not.toBe(second.id);
    expect(first.getAttribute("name")).toBe("email");
    expect(second.getAttribute("name")).toBe("email");
    expect(
      document.getElementById(first.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("First account email");
    expect(
      document.getElementById(second.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("Second account email");
  });
});
