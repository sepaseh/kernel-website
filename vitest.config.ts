import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    environmentOptions: { jsdom: { url: "https://website.example.test/" } },
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    env: { API_BASE_URL: "http://127.0.0.1:3100", NODE_ENV: "test" },
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "scripts/run-audit.test.mjs",
    ],
    coverage: {
      provider: "v8",
      include: [
        "scripts/run-audit.mjs",
        "src/i18n/catalog-data/locales.ts",
        "src/i18n/catalog-data/website-types.ts",
        "src/i18n/catalogs.ts",
        "src/i18n/client-messages.ts",
        "src/shared/api/client.ts",
        "src/shared/api/origin.ts",
        "src/shared/contracts/index.ts",
        "src/shared/fonts/preloads.ts",
        "src/shared/settings/contracts.ts",
        "src/shared/settings/language.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
