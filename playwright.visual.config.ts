import { fileURLToPath } from "node:url";

import type { PlaywrightTestConfig } from "@playwright/test";

import { loadPlaywrightConfig } from "./scripts/playwright-config.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const config: PlaywrightTestConfig = await loadPlaywrightConfig(root, "visual");
export default config;
