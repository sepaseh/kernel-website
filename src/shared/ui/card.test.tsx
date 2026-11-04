// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

describe("card primitive", () => {
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
});
