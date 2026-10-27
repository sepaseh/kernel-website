// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Input } from "./input";
import { Label } from "./label";

describe("local UI primitives", () => {
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

  it("keeps alert and status semantics while forwarding titles, descriptions and custom attributes", () => {
    render(
      <>
        <Alert className="notice">
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>Details</AlertDescription>
        </Alert>
        <Alert variant="destructive" role="status" aria-label="Failure">
          Try again
        </Alert>
      </>,
    );
    expect(screen.getByRole("alert").textContent).toBe("NoticeDetails");
    expect(screen.getByRole("alert").classList.contains("notice")).toBe(true);
    expect(screen.getByRole("status", { name: "Failure" }).textContent).toBe(
      "Try again",
    );
  });

  it("renders compound card content without losing consumer semantics", () => {
    const { rerender } = render(
      <Card role="region" aria-label="Account">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Public details</CardDescription>
        </CardHeader>
        <CardContent className="content">Ada</CardContent>
      </Card>,
    );
    const card = screen.getByRole("region", { name: "Account" });
    expect(card.getAttribute("data-size")).toBe("default");
    expect(card.textContent).toBe("ProfilePublic detailsAda");
    expect(screen.getByText("Ada").classList.contains("content")).toBe(true);
    rerender(
      <Card size="sm" className="compact" role="region" aria-label="Account">
        Compact
      </Card>,
    );
    expect(screen.getByRole("region").getAttribute("data-size")).toBe("sm");
  });

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
