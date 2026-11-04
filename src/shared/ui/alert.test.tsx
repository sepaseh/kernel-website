// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("alert primitive", () => {
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
});
