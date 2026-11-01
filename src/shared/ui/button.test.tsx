// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("button primitive", () => {
  it("preserves button interaction, native disabled semantics and caller classes", () => {
    const click = vi.fn();
    const { rerender } = render(
      <Button className="custom-button" onClick={click}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;
    expect(button.getAttribute("data-variant")).toBe("default");
    expect(button.getAttribute("data-size")).toBe("default");
    expect(button.classList.contains("custom-button")).toBe(true);
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
    rerender(
      <Button disabled onClick={click}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(click).toHaveBeenCalledOnce();
  });

  it("does not submit forms by default and preserves explicit submit buttons", () => {
    const submit = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={submit}>
        <Button>Toggle</Button>
        <Button type="submit">Save</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("composes an actual Radix Slot link without nesting a button", () => {
    const click = vi.fn();
    render(
      <Button asChild variant="outline" size="sm" onClick={click}>
        <a href="#next">Continue</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Continue" });
    expect(link.getAttribute("href")).toBe("#next");
    expect(link.getAttribute("data-variant")).toBe("outline");
    expect(link.getAttribute("type")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(link);
    expect(click).toHaveBeenCalledOnce();
  });

  it("preserves the child button's submit behavior when composing a Radix Slot", () => {
    const submit = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={submit}>
        <Button asChild>
          <button type="submit">Child submit</button>
        </Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Child submit" }));
    expect(submit).toHaveBeenCalledOnce();
  });
});
