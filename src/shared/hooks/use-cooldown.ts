"use client";
import { useEffect, useState } from "react";
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [until]);
  function start(seconds: number) {
    const current = Date.now();
    setNow(current);
    const bounded = Number.isFinite(seconds)
      ? Math.min(600, Math.max(1, seconds))
      : 1;
    setUntil(current + bounded * 1000);
  }
  return { remaining, start };
}
