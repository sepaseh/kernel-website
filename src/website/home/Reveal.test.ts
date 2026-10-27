import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reducedMotion } = vi.hoisted(() => ({ reducedMotion: vi.fn() }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: reducedMotion,
}));

import { Reveal } from "./Reveal";

describe("Reveal server rendering", () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));

  it("renders visible semantic content using the strict minimal Motion component", () => {
    const html = renderToStaticMarkup(
      createElement(
        Reveal,
        null,
        createElement("h2", null, "A complete server-rendered introduction"),
      ),
    );

    expect(html).toContain("<h2>A complete server-rendered introduction</h2>");
    expect(html).toContain("translateY(18px)");
    expect(html).not.toMatch(
      /opacity:0|display:none|visibility:hidden|hidden=/,
    );
    expect(html.match(/<div/g)).toHaveLength(1);
  });

  it("does not apply an initial displacement when reduced motion is enabled", () => {
    reducedMotion.mockReturnValue(true);
    const html = renderToStaticMarkup(
      createElement(
        Reveal,
        null,
        createElement("p", null, "Motion is optional"),
      ),
    );

    expect(html).toContain("<p>Motion is optional</p>");
    expect(html).not.toContain("translateY(18px)");
    expect(html).not.toMatch(
      /opacity:0|display:none|visibility:hidden|hidden=/,
    );
  });
});
