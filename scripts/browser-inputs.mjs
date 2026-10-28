import path from "node:path";

import { artifactFile, readArtifactFile } from "./release-files.mjs";
import {
  readyRunnerRoot,
  resolveApiFixture,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";

const readJson = async (filename) =>
  JSON.parse((await readArtifactFile(filename)).toString("utf8"));

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
    installed?.name !== "@playwright/test" ||
    installed?.version !== version ||
    installed?.bin?.playwright !== "cli.js"
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
      "KERNEL_API_DIRECTORY",
      "CI",
      "WEBSITE_SKIP_BUILD",
      "WEBSITE_TEST_CSP_MODE",
      "KERNEL_VISUAL_RUNNER",
    ].map((key) => [key, inherited?.[key]]),
  );
  const inputs = await syntheticRunnerInputs(directory, source);
  const { directory: apiDirectory } = await resolveApiFixture(
    directory,
    source,
  );
  const environment = {
    ...inputs.websiteEnvironment,
    KERNEL_API_DIRECTORY: apiDirectory,
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
    apiDirectory,
    websiteEnvironment: environment,
    apiEnvironment: { ...environment, PORT: inputs.apiEnvironment.PORT },
  };
}
