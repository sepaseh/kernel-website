import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareStandalone } from "./prepare-standalone.mjs";
import { artifactFile } from "./release-files.mjs";
import {
  readyRunnerRoot,
  resolveNextCli,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
import { verifyVerificationBuild } from "./verification-build.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

/**
 * Snapshot the explicit boolean override once; otherwise require the inherited
 * skip-build switch to use its exact 0/1 representation.
 */
function skipBuildOption(options, inherited) {
  const requested = options.skipBuild;
  if (requested !== undefined) {
    if (typeof requested !== "boolean")
      throw new Error("skipBuild must be an explicit boolean.");
    return requested;
  }
  const value = inherited.WEBSITE_SKIP_BUILD;
  if (value !== undefined && value !== "0" && value !== "1")
    throw new Error("WEBSITE_SKIP_BUILD must be 0 or 1.");
  return value === "1";
}

/**
 * Validate readiness and isolated inputs before resolving tools or starting work.
 * Await a successful fresh build and prepare its assets, or verify the exact
 * existing source/output/environment before starting its prepared server.
 */
export async function runTestWebsiteServer(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Server cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const inherited = options.environment ?? process.env;
  const inputs = await syntheticRunnerInputs(directory, inherited);
  const environment = inputs.websiteEnvironment;
  const mode = inherited.WEBSITE_TEST_CSP_MODE ?? environment.WEBSITE_CSP_MODE;
  if (mode !== undefined && !["report-only", "enforce"].includes(mode))
    throw new Error("WEBSITE_TEST_CSP_MODE must be report-only or enforce.");
  if (mode !== undefined) environment.WEBSITE_CSP_MODE = mode;
  const skipBuild = skipBuildOption(options, inherited);
  signal?.throwIfAborted();

  let server;
  if (skipBuild) {
    await verifyVerificationBuild(directory, { environment: inherited });
    server = await artifactFile(
      path.join(directory, ".next/standalone/server.js"),
    );
  } else {
    const next = await resolveNextCli(directory);
    await runOwnedProcess({
      command: process.execPath,
      args: [next, "build"],
      cwd: directory,
      env: environment,
      signal,
    });
    signal?.throwIfAborted();
    server = await prepareStandalone(directory);
  }
  signal?.throwIfAborted();
  return runOwnedProcess({
    command: process.execPath,
    args: [server],
    cwd: directory,
    env: environment,
    signal,
  });
}

await runVerificationCli(import.meta.main, repository, async ({ signal }) => {
  if (process.argv.length !== 2)
    throw new Error("The website server runner accepts no CLI arguments.");
  await runTestWebsiteServer(repository, { signal });
});
