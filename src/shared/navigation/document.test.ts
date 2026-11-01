import { expect, it, vi } from "vitest";

import { replaceDocument } from "./document";

it("replaces the document through the browser navigation boundary", () => {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { replace } });
  replaceDocument("/login?password=changed");
  expect(replace).toHaveBeenCalledExactlyOnceWith("/login?password=changed");
});
