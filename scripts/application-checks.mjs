import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolvePlaywrightCli,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import {
  evaluateWebsiteBudget,
  measureWebsiteBundle,
} from "./check-bundle-website.mjs";
import { artifactFile, readArtifactFile } from "./release-files.mjs";
import { runVisual } from "./run-visual.mjs";
import {
  readyRunnerRoot,
  resolveNextCli,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
import { runCspReportOnly } from "./test-csp-report-only.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const modes = new Set(["dead-code", "types", "build", "e2e", "visual"]);
/** Read JSON only through the unlinked regular-file guard; preserve parse failures. */
const readJson = async (filename) =>
  JSON.parse((await readArtifactFile(filename)).toString("utf8"));

/**
 * Resolve Knip for an already readiness-checked root without executing it.
 * Reject manifest, lock or installed identity drift before returning the guarded
 * local CLI path; missing files and malformed metadata remain failures.
 */
async function knipCli(root) {
  const [manifest, lock, installed] = await Promise.all([
    readJson(path.join(root, "package.json")),
    readJson(path.join(root, "package-lock.json")),
    readJson(path.join(root, "node_modules/knip/package.json")),
  ]);
  const version = manifest.devDependencies?.knip;
  if (
    !/^\d+\.\d+\.\d+$/.test(version ?? "") ||
    manifest.name !== "kernel-website" ||
    lock.lockfileVersion !== 3 ||
    lock.packages?.[""]?.devDependencies?.knip !== version ||
    lock.packages?.["node_modules/knip"]?.version !== version ||
    installed.name !== "knip" ||
    installed.version !== version
  )
    throw new Error(
      "Knip must match the exact root manifest, lock and installed package.",
    );
  return artifactFile(path.join(root, "node_modules/knip/bin/knip.js"));
}

/**
 * Check readiness before options, synthetic inputs or installed tools are read.
 * Dispatch one owned check: build awaits budget measurement, while E2E awaits
 * enforce-mode success before its report-only pass. Visual mode delegates to
 * the guarded capture owner; this entry does not establish application readiness.
 *
 * @param {string} root Website root with an explicit true readiness marker.
 * @param {string} mode One of dead-code, types, build, e2e or visual.
 * @param {object} options Public environment, cancellation and execution hooks.
 * @returns {Promise<unknown>} The selected check's result after owned completion.
 * @throws On invalid input, cancellation, child failure or an exceeded budget.
 */
export async function runApplicationCheck(root, mode, options = {}) {
  const directory = await readyRunnerRoot(root);
  if (!modes.has(mode)) throw new Error("Unknown application check.");
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError(
      "Application check cancellation requires an AbortSignal.",
    );
  signal?.throwIfAborted();
  const inherited = options.environment ?? process.env;
  const inputs = await syntheticRunnerInputs(directory, inherited);
  const environment = inputs.websiteEnvironment;
  const execute = options.execute ?? runOwnedProcess;
  const run = (args, env = environment) =>
    execute({
      args,
      cwd: directory,
      env,
      signal,
      stdio: options.stdio ?? "inherit",
    });

  if (mode === "dead-code") return run([await knipCli(directory)]);
  if (mode === "types")
    return run([await resolveNextCli(directory), "typegen"]);
  if (mode === "build") {
    await run([await resolveNextCli(directory), "build"]);
    const bundle = await (options.measureBundle ?? measureWebsiteBundle)(
      path.join(directory, ".next"),
    );
    const budget = await readJson(
      path.join(directory, "performance-budget.json"),
    );
    const failures = evaluateWebsiteBudget(bundle, budget);
    if (failures.length) throw new Error(failures.join("\n"));
    console.log("Production build and bundle budgets passed.");
    return;
  }
  const browserInputs = await syntheticBrowserInputs(directory, inherited);
  const browserEnvironment = {
    ...browserInputs.websiteEnvironment,
    WEBSITE_SKIP_BUILD: "1",
    WEBSITE_CSP_MODE: "enforce",
    WEBSITE_TEST_CSP_MODE: "enforce",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  };
  if (mode === "visual")
    return (options.visual ?? runVisual)(directory, {
      environment: browserEnvironment,
      signal,
    });
  await run(
    [
      await resolvePlaywrightCli(directory),
      "test",
      `--config=${path.join(directory, "playwright.website.config.ts")}`,
    ],
    browserEnvironment,
  );
  return (options.reportOnly ?? runCspReportOnly)(directory, {
    environment: browserEnvironment,
    signal,
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) => {
  if (process.argv.length !== 3)
    throw new Error("Specify exactly one application check.");
  return runApplicationCheck(repository, process.argv[2], { signal });
});
