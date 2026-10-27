// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { useOperationScope } from "./use-operation-scope";

describe("operation mount ownership", () => {
  it("lets an operation finish only while its originating mount is active", () => {
    const { result, rerender, unmount } = renderHook(() => useOperationScope());
    const capture = result.current;
    const isCurrent = capture();
    expect(isCurrent()).toBe(true);
    rerender();
    expect(result.current).toBe(capture);
    expect(isCurrent()).toBe(true);
    unmount();
    expect(isCurrent()).toBe(false);
  });

  it("invalidates StrictMode replayed work without invalidating the live mount", () => {
    const operations: (() => boolean)[] = [];
    const { unmount } = renderHook(
      () => {
        const capture = useOperationScope();
        useEffect(() => {
          operations.push(capture());
        }, [capture]);
      },
      { reactStrictMode: true },
    );
    expect(operations).toHaveLength(2);
    expect(operations[0]()).toBe(false);
    expect(operations[1]()).toBe(true);
    unmount();
    expect(operations[1]()).toBe(false);
  });
});
