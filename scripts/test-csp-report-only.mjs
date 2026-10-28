import { fileURLToPath } from "node:url";

import {
  resolvePlaywrightCli,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import { artifactFile } from "./release-files.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

export async function runCspReportOnly(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("CSP cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const argv = options.argv ?? [];
  if (!Array.isArray(argv) || argv.length)
    throw new Error("The CSP report-only runner accepts no extra arguments.");
  const inputs = await syntheticBrowserInputs(
    directory,
    options.environment ?? process.env,
  );
  const cli = await resolvePlaywrightCli(directory);
  const config = await artifactFile(
    `${directory}/playwright.website.config.ts`,
  );
  await artifactFile(`${directory}/e2e/website/csp.spec.ts`);
  signal?.throwIfAborted();
  return runOwnedProcess({
    args: [cli, "test", `--config=${config}`, "e2e/website/csp.spec.ts"],
    cwd: directory,
    env: {
      ...inputs.websiteEnvironment,
      WEBSITE_CSP_MODE: "report-only",
      WEBSITE_TEST_CSP_MODE: "report-only",
      WEBSITE_SKIP_BUILD: "1",
      PLAYWRIGHT_BROWSERS_PATH: "0",
    },
    signal,
    stdio: options.stdio ?? "inherit",
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runCspReportOnly(repository, { signal, argv: process.argv.slice(2) }),
);
