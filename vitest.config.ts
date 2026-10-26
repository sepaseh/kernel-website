import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    env: { API_BASE_URL: "http://127.0.0.1:3100" },
    include: ["src/**/*.test.ts", "scripts/run-audit.test.mjs"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/run-audit.mjs"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
