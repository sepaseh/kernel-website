import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { hook } = vi.hoisted(() => ({ hook: vi.fn() }));
vi.mock("next/web-vitals", () => ({ useReportWebVitals: hook }));
import { reportWebVital } from "./web-vitals";
import { WebVitals } from "./WebVitals";

it("registers one stable framework callback across component renders without UI", () => {
  expect(renderToStaticMarkup(createElement(WebVitals))).toBe("");
  renderToStaticMarkup(createElement(WebVitals));
  expect(hook.mock.calls.map(([callback]) => callback)).toEqual([
    reportWebVital,
    reportWebVital,
  ]);
});
