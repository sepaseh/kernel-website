import type { useReportWebVitals } from "next/web-vitals";

type FrameworkMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];
type WebVital = Readonly<{
  name: "CLS" | "INP" | "LCP" | "FCP" | "TTFB";
  value: number;
  delta: number;
  rating: "good" | "needs-improvement" | "poor";
  unit: "score" | "milliseconds";
}>;
type Reporter = (metric: WebVital) => void;
const reporters = new Set<Reporter>();
const names = new Set(["CLS", "INP", "LCP", "FCP", "TTFB"]);

/** Subscribe explicitly; by default nothing is stored, logged or transmitted. */
export function subscribeToWebVitals(reporter: Reporter): () => void {
  reporters.add(reporter);
  return () => {
    reporters.delete(reporter);
  };
}

/** Keep the framework's standard values; never sum CLS entries or approximate INP. */
export function reportWebVital(metric: FrameworkMetric): void {
  if (
    !reporters.size ||
    !names.has(metric.name) ||
    !Number.isFinite(metric.value) ||
    !Number.isFinite(metric.delta)
  )
    return;
  const value: WebVital = Object.freeze({
    name: metric.name as WebVital["name"],
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    unit: metric.name === "CLS" ? "score" : "milliseconds",
  });
  for (const reporter of [...reporters]) {
    try {
      reporter(value);
    } catch {
      /* A consumer must not break the page. */
    }
  }
}
