"use client";
import { useCallback, useLayoutEffect, useRef } from "react";

export function useOperationScope() {
  const scope = useRef({ active: false });
  useLayoutEffect(() => {
    const current = { active: true };
    scope.current = current;
    return () => {
      current.active = false;
    };
  }, []);

  return useCallback(() => {
    const current = scope.current;
    return () => current.active;
  }, []);
}
