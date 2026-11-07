// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import type * as MotionComponents from "motion/react-m";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { animationComplete, motionProps, reducedMotion } = vi.hoisted(() => ({
  animationComplete: vi.fn(),
  motionProps: vi.fn(),
  reducedMotion: vi.fn(),
}));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: reducedMotion,
}));
vi.mock("motion/react-m", async (importOriginal) => {
  const original = await importOriginal<typeof MotionComponents>();
  const { createElement, forwardRef } = await import("react");
  return {
    ...original,
    div: forwardRef<HTMLDivElement, ComponentProps<typeof original.div>>(
      (props, ref) => {
        motionProps(props);
        return createElement(original.div, {
          ...props,
          ref,
          onAnimationComplete: (definition) => {
            props.onAnimationComplete?.(definition);
            animationComplete(definition);
          },
        });
      },
    ),
  };
});

import { Reveal } from "./Reveal";

class ControlledObserver implements IntersectionObserver {
  readonly root;
  readonly rootMargin;
  readonly scrollMargin = "0px";
  readonly thresholds;
  readonly targets = new Set<Element>();
  readonly observe = vi.fn((target: Element) => this.targets.add(target));
  readonly unobserve = vi.fn((target: Element) => this.targets.delete(target));
  readonly disconnect = vi.fn(() => this.targets.clear());
  readonly takeRecords = () => [];
  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? "0px";
    this.thresholds =
      typeof options.threshold === "number"
        ? [options.threshold]
        : (options.threshold ?? [0]);
  }
  intersect(target: Element, isIntersecting: boolean) {
    if (!this.targets.has(target)) return;
    const bounds = target.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: bounds,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: bounds,
          isIntersecting,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this,
    );
  }
}

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

describe("Reveal viewport ownership", () => {
  const observers: ControlledObserver[] = [];
  beforeEach(() => {
    observers.length = 0;
    animationComplete.mockReset();
    reducedMotion.mockReturnValue(false);
    vi.stubGlobal(
      "IntersectionObserver",
      class extends ControlledObserver {
        constructor(
          callback: IntersectionObserverCallback,
          options: IntersectionObserverInit,
        ) {
          super(callback, options);
          observers.push(this);
        }
      },
    );
  });

  it("reveals once at the reviewed viewport margin and disconnects its observer on unmount", () => {
    const { container, unmount } = render(
      createElement(Reveal, { children: "Visible content", delay: 0.3 }),
    );
    const element = container.querySelector("div");
    if (!element) throw new Error("Reveal must render its owned element.");
    expect(observers).toHaveLength(1);
    const [observer] = observers;
    expect(observer.rootMargin).toBe("-20px");
    expect(observer.thresholds).toEqual([0]);
    expect(observer.observe).toHaveBeenCalledWith(element);
    expect(motionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animate: {},
        initial: { y: 18 },
        transition: { duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] },
      }),
    );
    act(() => observer.intersect(element, true));
    expect(motionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ animate: { y: 0 } }),
    );
    expect(observer.unobserve).toHaveBeenCalledWith(element);
    act(() => observer.intersect(element, false));
    expect(motionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ animate: { y: 0 } }),
    );
    unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("preserves reduced-motion initialization and zero timing without an offscreen animation target", () => {
    reducedMotion.mockReturnValue(true);
    const { container, unmount } = render(
      createElement(Reveal, { children: "Visible content", delay: 0.3 }),
    );
    const element = container.querySelector("div");
    if (!element) throw new Error("Reveal must render its owned element.");
    expect(motionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animate: {},
        initial: false,
        transition: { duration: 0, delay: 0, ease: [0.22, 1, 0.36, 1] },
      }),
    );
    act(() => observers[0].intersect(element, true));
    expect(motionProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ animate: { y: 0 }, initial: false }),
    );
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it("clears an existing server-position offset on entry after reduced motion becomes available", async () => {
    const props = { children: "Visible content", delay: 0.3 };
    const { container, rerender, unmount } = render(
      createElement(Reveal, props),
    );
    const element = container.querySelector("div");
    if (!element) throw new Error("Reveal must render its owned element.");
    expect(element.style.transform).toBe("translateY(18px)");
    reducedMotion.mockReturnValue(true);
    rerender(createElement(Reveal, props));
    expect(element.style.transform).toBe("translateY(18px)");
    const completed = new Promise<void>((resolve) => {
      animationComplete.mockImplementation((definition: unknown) => {
        if (
          definition &&
          typeof definition === "object" &&
          "y" in definition &&
          definition.y === 0
        )
          resolve();
      });
    });
    let observeTransform: MutationObserver;
    const rendered = new Promise<void>((resolve) => {
      observeTransform = new MutationObserver(() => {
        if (element.style.transform === "none") resolve();
      });
      observeTransform.observe(element, {
        attributes: true,
        attributeFilter: ["style"],
      });
    });
    try {
      act(() => observers[0].intersect(element, true));
      await act(() => Promise.all([completed, rendered]));
      expect(element.style.transform).toBe("none");
    } finally {
      observeTransform!.disconnect();
      unmount();
    }
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });
});
