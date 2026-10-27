import { describe, expect, it } from "vitest";

import { cn } from "./utils.ts";

describe("website class composition", () => {
  it("combines conditional classes and resolves conflicting Tailwind utilities", () => {
    expect(
      cn(
        "px-2 text-sm",
        ["rounded", false],
        { hidden: false, flex: true },
        "px-4",
      ),
    ).toBe("text-sm rounded flex px-4");
    expect(cn(undefined, null, false)).toBe("");
    expect(cn("hover:px-2 px-2", "hover:px-4 px-6")).toBe("hover:px-4 px-6");
  });
});
