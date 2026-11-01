"use client";

import { useReportWebVitals } from "next/web-vitals";

import { reportWebVital } from "./web-vitals";

export function WebVitals() {
  // A module-level callback prevents duplicate reporting after re-renders.
  useReportWebVitals(reportWebVital);
  return null;
}
