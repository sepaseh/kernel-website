import path from "node:path";

import {
  resolvePlaywrightCli,
  resolvePlaywrightInstallation,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import {
  validateSmokeTargets,
  validateStagingTargets,
} from "./validate-workflow-targets.mjs";
import { assertVisualMode } from "./visual-environment.mjs";

const modes = new Set(["smoke", "staging", "visual", "website"]);

const parentEnvironmentKeys = new Set([
  "API_BASE_URL",
  "BROWSERSLIST_IGNORE_OLD_DATA",
  "CI",
  "DEBUG_COLORS",
  "FORCE_COLOR",
  "HOSTNAME",
  "KERNEL_API_DIRECTORY",
  "KERNEL_SYNTHETIC_ENV",
  "KERNEL_VISUAL_RUNNER",
  "NEXT_TELEMETRY_DISABLED",
  "NODE_ENV",
  "PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PORT",
  "SMOKE_ALLOWED_API_HOST",
  "SMOKE_ALLOWED_APP_HOST",
  "SMOKE_API_HEALTH_URL",
  "SMOKE_BASE_URL",
  "SMOKE_DEPLOYMENT_ID",
  "SMOKE_EXPECTED_DEPLOYMENT_ID",
  "STAGING_ALLOWED_API_HOST",
  "STAGING_ALLOWED_APP_HOST",
  "STAGING_API_HEALTH_URL",
  "STAGING_BASE_URL",
  "SystemRoot",
  "TEMP",
  "TEST_PARALLEL_INDEX",
  "TEST_WORKER_INDEX",
  "TMP",
  "WEBSITE_CSP_MODE",
  "WEBSITE_INDEXING_ENABLED",
  "WEBSITE_SKIP_BUILD",
  "WEBSITE_TEST_CSP_MODE",
  "WEBSITE_URL",
]);

// Windows supplies these runtime names even to a child with an explicit env.
// Check names only; no host identity or directory values are inspected here.
const windowsRuntimeKeys = new Set([
  "HOMEDRIVE",
  "HOMEPATH",
  "LOGONSERVER",
  "SYSTEMDRIVE",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
]);

export async function assertPlaywrightParentEnvironment(root, environment) {
  const directory = await readyRunnerRoot(root);
  if (
    !environment ||
    typeof environment !== "object" ||
    Array.isArray(environment)
  )
    throw new Error(
      "Playwright parent environment must be an explicit object.",
    );
  const unexpected = Object.getOwnPropertyNames(environment).filter(
    (key) =>
      key !== "PLAYWRIGHT_TEST" &&
      !parentEnvironmentKeys.has(key) &&
      !(process.platform === "win32" && windowsRuntimeKeys.has(key)),
  );
  const symbolCount = Object.getOwnPropertySymbols(environment).length;
  if (unexpected.length || symbolCount)
    throw new Error(
      `Playwright requires an explicitly filtered parent environment; unexpected keys are forbidden: ${JSON.stringify(unexpected.slice(0, 16).map((key) => key.slice(0, 80)))} (${unexpected.length} names, ${symbolCount} symbols).`,
    );
  const workerMarker = Object.getOwnPropertyDescriptor(
    environment,
    "PLAYWRIGHT_TEST",
  );
  if (workerMarker) {
    if (workerMarker.value !== "1")
      throw new Error(
        "The reviewed Playwright worker marker must be the literal string 1.",
      );
    const sdk = await resolvePlaywrightInstallation(directory);
    if (sdk.version !== "1.64.1")
      throw new Error(
        "The worker marker requires the reviewed installed Playwright 1.64.1 identity.",
      );
  }
  return directory;
}

/** Guard the actual SDK parent because its web-server launcher merges ambient values. */
export async function loadPlaywrightConfig(root, mode) {
  const directory = await assertPlaywrightParentEnvironment(root, process.env);
  return createPlaywrightConfig(directory, mode);
}

function reporters(root, mode) {
  return [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: path.join(root, "playwright-report", mode),
      },
    ],
  ];
}

function fixtureServers(root, inputs) {
  return [
    {
      command: "node scripts/test-website-api.mjs",
      cwd: root,
      env: inputs.websiteEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
      url: `${inputs.apiOrigin}/health`,
    },
    {
      command: "node scripts/test-website-server.mjs",
      cwd: root,
      env: inputs.websiteEnvironment,
      reuseExistingServer: false,
      timeout: 240_000,
      url: `${inputs.websiteOrigin}/login`,
    },
  ];
}

function operationTargets(mode, environment) {
  const prefix = mode.toUpperCase();
  const keys = [
    "ALLOWED_API_HOST",
    "ALLOWED_APP_HOST",
    "API_HEALTH_URL",
    "BASE_URL",
    ...(mode === "smoke" ? ["DEPLOYMENT_ID", "EXPECTED_DEPLOYMENT_ID"] : []),
  ];
  const values = Object.fromEntries(
    keys.map((key) => [`${prefix}_${key}`, environment[`${prefix}_${key}`]]),
  );
  if (mode === "smoke") validateSmokeTargets(values);
  else validateStagingTargets(values);

  return {
    apiHealthUrl: values[`${prefix}_API_HEALTH_URL`],
    baseUrl: values[`${prefix}_BASE_URL`],
    ...(mode === "smoke" ? { deploymentId: values.SMOKE_DEPLOYMENT_ID } : {}),
    mode,
  };
}

function operationalConfig(root, mode, environment) {
  const targets = operationTargets(mode, environment);
  const browsers =
    mode === "staging" ? ["chromium", "firefox", "webkit"] : ["chromium"];
  return {
    forbidOnly: true,
    metadata: { kernelBrowserTargets: targets },
    outputDir: path.join(root, "test-results", mode),
    projects: browsers.map((browserName) => ({
      name: browserName,
      use: { browserName, viewport: { height: 720, width: 1280 } },
    })),
    reporter: reporters(root, mode),
    retries: 0,
    testDir: path.join(root, "e2e", "operations"),
    testMatch: `${mode}.spec.ts`,
    use: {
      baseURL: targets.baseUrl,
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
    workers: 1,
  };
}

function visualConfig(root, environment, argv, inputs) {
  if (environment.KERNEL_VISUAL_RUNNER !== "1")
    throw new Error("Visual configuration requires the guarded visual runner.");
  if (
    !Array.isArray(argv) ||
    argv.some((argument) => typeof argument !== "string")
  )
    throw new Error("Visual command arguments must be explicit strings.");
  const updateArguments = argv.filter((argument) =>
    argument.startsWith("--update-snapshots"),
  );
  if (
    updateArguments.some(
      (argument) =>
        argument !== "--update-snapshots" &&
        argument !== "--update-snapshots=all",
    )
  )
    throw new Error("Visual updates require the guarded all-snapshots mode.");
  const update = updateArguments.length > 0;
  assertVisualMode({
    ci: Boolean(environment.CI),
    platform: process.platform,
    update,
  });

  return {
    expect: {
      timeout: 10_000,
      toHaveScreenshot: {
        animations: "disabled",
        caret: "hide",
        maxDiffPixels: 40,
        scale: "css",
        threshold: 0.1,
      },
    },
    forbidOnly: Boolean(environment.CI),
    fullyParallel: false,
    outputDir: path.join(root, "test-results", "visual"),
    projects: [{ name: "pinned-chromium" }],
    reporter: reporters(root, "visual"),
    retries: 0,
    snapshotPathTemplate: "{testDir}/baselines/{platform}/{arg}{ext}",
    testDir: path.join(root, "e2e", "visual"),
    testMatch: "website.spec.ts",
    timeout: 45_000,
    updateSnapshots: update ? "all" : "none",
    use: {
      baseURL: inputs.websiteOrigin,
      browserName: "chromium",
      channel: "chromium",
      colorScheme: "light",
      deviceScaleFactor: 1,
      locale: "en-US",
      reducedMotion: "reduce",
      screenshot: "only-on-failure",
      serviceWorkers: "block",
      timezoneId: "UTC",
      trace: "retain-on-failure",
      viewport: { height: 900, width: 1280 },
    },
    webServer: fixtureServers(root, inputs),
    workers: 1,
  };
}

/** Build data only; the caller must separately authorize future browser execution.
 * @returns {Promise<import("@playwright/test").PlaywrightTestConfig>}
 */
export async function createPlaywrightConfig(root, mode, options = {}) {
  const directory = await readyRunnerRoot(root);
  if (!modes.has(mode)) throw new Error("Unknown browser configuration mode.");
  const environment = options.environment ?? process.env;
  await resolvePlaywrightCli(directory);
  if (mode === "smoke" || mode === "staging")
    return operationalConfig(directory, mode, environment);

  const inputs = await syntheticBrowserInputs(directory, environment);
  if (mode === "visual")
    return visualConfig(
      directory,
      inputs.websiteEnvironment,
      options.argv ?? process.argv.slice(2),
      inputs,
    );

  return {
    expect: { timeout: 15_000 },
    forbidOnly: Boolean(inputs.websiteEnvironment.CI),
    fullyParallel: false,
    outputDir: path.join(directory, "test-results", "website"),
    projects: [
      {
        name: "website-chromium",
        use: {
          browserName: "chromium",
          viewport: { height: 720, width: 1280 },
        },
      },
    ],
    reporter: reporters(directory, "website"),
    retries: 0,
    testDir: path.join(directory, "e2e", "website"),
    timeout: 90_000,
    use: {
      baseURL: inputs.websiteOrigin,
      reducedMotion: "reduce",
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
    },
    webServer: fixtureServers(directory, inputs),
    workers: 1,
  };
}
