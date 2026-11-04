// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCooldown } from "./use-cooldown";

describe("cooldown lifecycle", () => {
  it("counts down a bounded retry delay and cleans up the interval on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, unmount } = renderHook(() => useCooldown(), {
      reactStrictMode: true,
    });
    expect(result.current.remaining).toBe(0);
    act(() => result.current.start(3));
    expect(result.current.remaining).toBe(3);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.remaining).toBe(2);
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.remaining).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0,
  ])("keeps malformed retry input finite and bounded: %s", (seconds) => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCooldown());
    act(() => result.current.start(seconds));
    expect(Number.isFinite(result.current.remaining)).toBe(true);
    expect(result.current.remaining).toBeGreaterThanOrEqual(1);
    expect(result.current.remaining).toBeLessThanOrEqual(600);
  });

  it("caps long delays and restarts without leaking old intervals", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCooldown());
    act(() => result.current.start(900));
    expect(result.current.remaining).toBe(600);
    act(() => result.current.start(2));
    expect(result.current.remaining).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
  });
});
