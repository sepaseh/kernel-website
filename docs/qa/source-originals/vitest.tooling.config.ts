import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/run-audit.test.mjs",
      "scripts/validate-workflow-targets.test.mjs",
    ],
  },
});
