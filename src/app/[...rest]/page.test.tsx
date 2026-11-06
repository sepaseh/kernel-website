// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import CatchAll from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

describe("unknown route dispatch", () => {
  it("returns a real framework not-found signal", () => {
    expect(() => CatchAll()).toThrow("NEXT_NOT_FOUND");
  });
});
