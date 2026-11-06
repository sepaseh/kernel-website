import { findPackageJSON } from "node:module";
import path from "node:path";

import { artifactFile, readArtifactFile } from "./release-files.mjs";
import {
  readyRunnerRoot,
  resolveApiFixture,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";

const readJson = async (filename) =>
  JSON.parse((await readArtifactFile(filename)).toString("utf8"));

async function playwrightDependency(directory, lock, owner, name, version) {
  const relative = `node_modules/${name}`;
  const filename = path.join(directory, relative, "package.json");
  if (findPackageJSON(name, owner) !== filename)
    throw new Error(
      "Playwright dependencies must resolve inside their root-owned installation.",
    );
  const installed = await readJson(filename);
  if (
    installed?.name !== name ||
    installed?.version !== version ||
    lock?.packages?.[relative]?.version !== version
  )
    throw new Error(
      "Playwright transitive packages must match the exact manifest and lock version.",
    );
  return installed;
}

async function playwrightEntry(directory, installed, exported, mode, relative) {
  const conditions = installed.exports?.[exported];
  let target;
  if (typeof conditions === "string") target = conditions;
  else if (
    conditions &&
    typeof conditions === "object" &&
    !Array.isArray(conditions) &&
    Object.keys(conditions).every((condition) =>
      ["types", "import", "require", "default"].includes(condition),
    )
  )
    target = Object.entries(conditions).find(([condition]) =>
      [mode, "default"].includes(condition),
    )?.[1];
  if (target !== `./${relative}`)
    throw new Error(
      "Playwright entry points must select their reviewed root-owned installation.",
    );
  return artifactFile(path.join(directory, relative));
}

async function playwrightPackage(root, includeModule) {
  const directory = await readyRunnerRoot(root);
  const manifest = await readJson(path.join(directory, "package.json"));
  const lock = await readJson(path.join(directory, "package-lock.json"));
  const installed = await readJson(
    path.join(directory, "node_modules/@playwright/test/package.json"),
  );
  const version = manifest?.devDependencies?.["@playwright/test"];
  if (
    manifest?.name !== "kernel-website" ||
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version) ||
    lock?.lockfileVersion !== 3 ||
    lock?.packages?.[""]?.name !== "kernel-website" ||
    lock?.packages?.[""]?.devDependencies?.["@playwright/test"] !== version ||
    lock?.packages?.["node_modules/@playwright/test"]?.version !== version ||
    lock?.packages?.["node_modules/@playwright/test"]?.dependencies
      ?.playwright !== version ||
    installed?.name !== "@playwright/test" ||
    installed?.version !== version ||
    installed?.bin?.playwright !== "cli.js" ||
    installed?.dependencies?.playwright !== version
  )
    throw new Error(
      "Playwright must be a root-owned installed @playwright/test matching its exact manifest and lock version.",
    );
  const cli = await artifactFile(
    path.join(directory, "node_modules/@playwright/test/cli.js"),
  );
  const module = includeModule
    ? await artifactFile(
        path.join(directory, "node_modules/@playwright/test/index.mjs"),
      )
    : undefined;

  const playwrightDirectory = path.join(directory, "node_modules/playwright");
  const playwright = await playwrightDependency(
    directory,
    lock,
    cli,
    "playwright",
    version,
  );
  if (
    playwright.dependencies?.["playwright-core"] !== version ||
    lock.packages["node_modules/playwright"].dependencies?.[
      "playwright-core"
    ] !== version
  )
    throw new Error(
      "Playwright must pin its reviewed playwright-core dependency.",
    );
  const program = await playwrightEntry(
    playwrightDirectory,
    playwright,
    "./lib/program",
    "require",
    "lib/program.js",
  );
  const core = await playwrightDependency(
    directory,
    lock,
    program,
    "playwright-core",
    version,
  );
  const coreDirectory = path.join(directory, "node_modules/playwright-core");
  await playwrightEntry(coreDirectory, core, ".", "require", "index.js");
  if (module) {
    await playwrightEntry(
      playwrightDirectory,
      playwright,
      "./test",
      "require",
      "test.js",
    );
    await playwrightEntry(
      playwrightDirectory,
      playwright,
      "./test",
      "import",
      "test.mjs",
    );
    await playwrightEntry(coreDirectory, core, ".", "import", "index.mjs");
  }
  return { cli, version, module };
}

export async function resolvePlaywrightCli(root) {
  return (await playwrightPackage(root, false)).cli;
}

export async function resolvePlaywrightInstallation(root) {
  return playwrightPackage(root, true);
}

export async function syntheticBrowserInputs(root, inherited = process.env) {
  const directory = await readyRunnerRoot(root);
  const source = Object.fromEntries(
    [
      "PATH",
      "SystemRoot",
      "TEMP",
      "TMP",
      "NODE_ENV",
      "API_BASE_URL",
      "HOSTNAME",
      "PORT",
      "WEBSITE_URL",
      "WEBSITE_INDEXING_ENABLED",
      "WEBSITE_CSP_MODE",
      "KERNEL_SYNTHETIC_ENV",
      "CI",
      "WEBSITE_SKIP_BUILD",
      "WEBSITE_TEST_CSP_MODE",
      "KERNEL_VISUAL_RUNNER",
    ].map((key) => [key, inherited?.[key]]),
  );
  const inputs = await syntheticRunnerInputs(directory, source);
  await resolveApiFixture(directory, source);
  const environment = {
    ...inputs.websiteEnvironment,
  };
  const ci = source.CI;
  if (ci !== undefined && typeof ci !== "string")
    throw new Error("CI must be an explicit string marker when supplied.");
  environment.CI = ci ? "1" : "";
  for (const [key, choices] of [
    ["WEBSITE_SKIP_BUILD", ["0", "1"]],
    ["WEBSITE_TEST_CSP_MODE", ["report-only", "enforce"]],
    ["KERNEL_VISUAL_RUNNER", ["1"]],
  ]) {
    const value = source[key];
    if (value !== undefined) {
      if (!choices.includes(value))
        throw new Error(`${key} must use an explicit supported mode.`);
      environment[key] = value;
    }
  }
  return {
    ...inputs,
    websiteEnvironment: environment,
    apiEnvironment: { ...environment, PORT: inputs.apiEnvironment.PORT },
  };
}
