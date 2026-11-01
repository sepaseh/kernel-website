import { afterEach, describe, expect, it, vi } from "vitest";

import { reportWebVital, subscribeToWebVitals } from "./web-vitals";

type Metric = Parameters<typeof reportWebVital>[0];
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});
const metric = (
  name: Metric["name"],
  value: number,
  delta = value,
): Metric => ({
  name,
  value,
  delta,
  rating: "good",
  id: "private-id",
  navigationType: "navigate",
  entries: [],
});

describe("website standard Web Vitals boundary", () => {
  it("preserves the standard CLS score and INP milliseconds without accumulating updates", () => {
    const reports = vi.fn();
    cleanups.push(subscribeToWebVitals(reports));
    reportWebVital(metric("CLS", 0.08, 0.05));
    reportWebVital(metric("CLS", 0.09, 0.01));
    reportWebVital(metric("INP", 184, 32));
    expect(reports.mock.calls.map(([value]) => value)).toEqual([
      { name: "CLS", value: 0.08, delta: 0.05, rating: "good", unit: "score" },
      { name: "CLS", value: 0.09, delta: 0.01, rating: "good", unit: "score" },
      {
        name: "INP",
        value: 184,
        delta: 32,
        rating: "good",
        unit: "milliseconds",
      },
    ]);
  });
  it("excludes identifiers, URLs, entries, account data and unapproved properties", () => {
    const reports = vi.fn();
    cleanups.push(subscribeToWebVitals(reports));
    const input = Object.assign(metric("LCP", 123), {
      navigationURL: "https://private.test/account?token=secret",
      account: { email: "private@example.test" },
      entries: [{ name: "https://private.test/private-image" }],
    });
    reportWebVital(input);
    expect(Object.keys(reports.mock.calls[0][0]).sort()).toEqual([
      "delta",
      "name",
      "rating",
      "unit",
      "value",
    ]);
    expect(JSON.stringify(reports.mock.calls)).not.toMatch(
      /private|secret|account/,
    );
    expect(Object.isFrozen(reports.mock.calls[0][0])).toBe(true);
  });
  it("has no default transport or retained reports and supports explicit unsubscribe", () => {
    reportWebVital(metric("FCP", 100));
    const reports = vi.fn();
    const unsubscribe = subscribeToWebVitals(reports);
    expect(reports).not.toHaveBeenCalled();
    reportWebVital(metric("TTFB", 150));
    unsubscribe();
    reportWebVital(metric("TTFB", 200));
    expect(reports).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid numbers and isolates a failing optional consumer", () => {
    cleanups.push(
      subscribeToWebVitals(() => {
        throw new Error("sink failure");
      }),
    );
    const reports = vi.fn();
    cleanups.push(subscribeToWebVitals(reports));
    reportWebVital(metric("INP", Number.NaN));
    reportWebVital(metric("CLS", 0.1, Infinity));
    reportWebVital(metric("INP", 201));
    expect(reports).toHaveBeenCalledTimes(1);
  });
  it("dispatches once per metric when a consumer re-subscribes during delivery", () => {
    const received: number[] = [];
    let unsubscribe = () => {};
    const reporter = (value: { value: number }) => {
      received.push(value.value);
      unsubscribe();
      if (received.length < 3) unsubscribe = subscribeToWebVitals(reporter);
    };
    unsubscribe = subscribeToWebVitals(reporter);
    cleanups.push(() => unsubscribe());
    reportWebVital(metric("CLS", 0.08));
    expect(received).toEqual([0.08]);
    reportWebVital(metric("CLS", 0.09));
    expect(received).toEqual([0.08, 0.09]);
  });
});
