// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./input";
import { Label } from "./label";

describe("input and label composition", () => {
  it("associates the real Radix label and forwards native input constraints and events", () => {
    const change = vi.fn();
    render(
      <>
        <Label htmlFor="email" className="label">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue="old@example.test"
          className="field"
          onChange={change}
        />
      </>,
    );
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.type).toBe("email");
    expect(input.classList.contains("field")).toBe(true);
    fireEvent.change(input, { target: { value: "new@example.test" } });
    expect(input.value).toBe("new@example.test");
    expect(change).toHaveBeenCalledOnce();
  });
});
