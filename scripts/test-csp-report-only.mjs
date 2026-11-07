import { fileURLToPath } from "node:url";

import {
  resolvePlaywrightCli,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import { artifactFile } from "./release-files.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
import { verifyVerificationBuild } from "./verification-build.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

/**
 * Check readiness before reading options, resolving the SDK or inspecting suite
 * files. Run only the CSP scenario with forced report-only markers and skip-build
 * mode, using validated synthetic origins and the selected local Playwright CLI.
 * @param {string} root Website root with an explicit true readiness marker.
 * @param {object} options Public environment, AbortSignal, empty argv and stdio.
 * @returns {Promise<object>} Owned child exit details after successful completion;
 * invalid inputs, cancellation, missing artifacts and child failures reject.
 * This entry performs no build.
 */
export async function runCspReportOnly(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("CSP cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const argv = options.argv ?? [];
  if (!Array.isArray(argv) || argv.length)
    throw new Error("The CSP report-only runner accepts no extra arguments.");
  const inherited = options.environment ?? process.env;
  const inputs = await syntheticBrowserInputs(directory, inherited);
  await verifyVerificationBuild(directory, { environment: inherited });
  signal?.throwIfAborted();
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
