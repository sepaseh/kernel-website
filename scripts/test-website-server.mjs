import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareStandalone } from "./prepare-standalone.mjs";
import { artifactFile, readArtifactFile } from "./release-files.mjs";
import {
  readyRunnerRoot,
  resolveNextCli,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

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

async function requireCompletedBuild(root) {
  const filename = await artifactFile(path.join(root, ".next/BUILD_ID"));
  const entry = await stat(filename);
  if (entry.size < 1 || entry.size > 1024)
    throw new Error("Skipping a build requires a bounded, nonempty BUILD_ID.");
  const value = (await readArtifactFile(filename)).toString("utf8");
  if (!value.trim() || value.includes("\0"))
    throw new Error("Skipping a build requires a nonempty public BUILD_ID.");
}

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

  if (skipBuild) await requireCompletedBuild(directory);
  else {
    const next = await resolveNextCli(directory);
    await runOwnedProcess({
      command: process.execPath,
      args: [next, "build"],
      cwd: directory,
      env: environment,
      signal,
    });
  }
  signal?.throwIfAborted();
  const server = await prepareStandalone(directory);
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
