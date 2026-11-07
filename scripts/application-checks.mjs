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
import { prepareStandalone } from "./prepare-standalone.mjs";
import {
  artifactFile,
  completeArtifactWork,
  readArtifactFile,
} from "./release-files.mjs";
import { runVisual } from "./run-visual.mjs";
import {
  readyRunnerRoot,
  resolveNextCli,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
import { runCspReportOnly } from "./test-csp-report-only.mjs";
import {
  fingerprintBuildSource,
  invalidateVerificationBuild,
  recordVerificationBuild,
  verifyVerificationBuild,
} from "./verification-build.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const browserSuites = {
  accessibility: ["accessibility.spec.ts"],
  csp: ["csp.spec.ts"],
  e2e: [
    "client-boundaries.spec.ts",
    "font-performance.spec.ts",
    "performance.spec.ts",
    "session-isolation.spec.ts",
    "website.spec.ts",
  ],
  seo: ["seo.spec.ts"],
};
const modes = new Set([
  "dead-code",
  "types",
  "build",
  ...Object.keys(browserSuites),
  "visual",
]);
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

/** Record only a completed, budget-checked and prepared production build. */
async function buildWebsite(
  directory,
  environment,
  run,
  measureBundle,
  signal,
) {
  await invalidateVerificationBuild(directory);
  try {
    const source = await fingerprintBuildSource(directory, { signal });
    const next = await resolveNextCli(directory);
    signal?.throwIfAborted();
    await run([next, "build"]);
    signal?.throwIfAborted();
    const bundle = await measureBundle(path.join(directory, ".next"));
    signal?.throwIfAborted();
    const budget = await readJson(
      path.join(directory, "performance-budget.json"),
    );
    signal?.throwIfAborted();
    const failures = evaluateWebsiteBudget(bundle, budget);
    if (failures.length) throw new Error(failures.join("\n"));

    await prepareStandalone(directory);
    signal?.throwIfAborted();
    await recordVerificationBuild(directory, { environment, source, signal });
    signal?.throwIfAborted();
    console.log("Production build and bundle budgets passed.");
  } catch (error) {
    if (signal?.aborted)
      await completeArtifactWork([
        Promise.reject(error),
        invalidateVerificationBuild(directory),
      ]);
    throw error;
  }
}

/**
 * Check readiness before options, synthetic inputs or installed tools are read.
 * Dispatch one owned check: build awaits budget measurement, while CSP awaits
 * enforce-mode success before its report-only pass. Visual mode delegates to
 * the guarded capture owner; this entry does not establish application readiness.
 *
 * @param {string} root Website root with an explicit true readiness marker.
 * @param {string} mode One of the declared static, build or browser checks.
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
  const environment = Object.freeze(inputs.websiteEnvironment);
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
    return buildWebsite(
      directory,
      environment,
      run,
      options.measureBundle ?? measureWebsiteBundle,
      signal,
    );
  }
  const browserInputs = await syntheticBrowserInputs(directory, inherited);
  await verifyVerificationBuild(directory, { environment: inherited });
  signal?.throwIfAborted();
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
      reuseBuild: true,
    });
  await run(
    [
      await resolvePlaywrightCli(directory),
      "test",
      `--config=${path.join(directory, "playwright.website.config.ts")}`,
      ...browserSuites[mode].map((filename) => `e2e/website/${filename}`),
    ],
    browserEnvironment,
  );
  if (mode === "csp")
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
