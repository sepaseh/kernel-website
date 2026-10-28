import path from "node:path";

import { apiRepository } from "./api-repository.mjs";
import {
  artifactFile,
  readArtifactFile,
  requireApplicationReady,
} from "./release-files.mjs";
import {
  validateDeploymentEnv,
  validateOrigin,
} from "./validate-deployment-env.mjs";
import { assertCleanWebsiteEnvironment } from "./website-performance-environment.mjs";

export async function readyRunnerRoot(root) {
  const directory = await requireApplicationReady(root);
  assertCleanWebsiteEnvironment(directory);
  return directory;
}

const requiredString = (environment, key) => {
  const value = environment?.[key];
  if (typeof value !== "string" || !value.trim() || /[\0\r\n]/.test(value))
    throw new Error(`${key} must be an explicit nonempty public setting.`);
  return value;
};

function runtimeEnvironment(inherited) {
  const environment = {};
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) {
    const value = inherited?.[key];
    if (typeof value === "string" && value && !/[\0\r\n]/.test(value))
      environment[key] = value;
  }
  return environment;
}

function publicWebsiteEnvironment(inherited) {
  const environment = runtimeEnvironment(inherited);
  for (const key of ["NODE_ENV", "API_BASE_URL", "HOSTNAME", "PORT"])
    environment[key] = requiredString(inherited, key);
  for (const key of [
    "WEBSITE_URL",
    "WEBSITE_INDEXING_ENABLED",
    "WEBSITE_CSP_MODE",
  ]) {
    const value = inherited?.[key];
    if (value !== undefined) {
      if (typeof value !== "string" || /[\0\r\n]/.test(value))
        throw new Error(`${key} must be a public string setting.`);
      environment[key] = value;
    }
  }
  if (
    !/^[1-9]\d{0,4}$/.test(environment.PORT) ||
    Number(environment.PORT) > 65535
  )
    throw new Error("PORT must be an explicit TCP port from 1 to 65535.");
  if (!/^[A-Za-z0-9.:[\]-]+$/.test(environment.HOSTNAME))
    throw new Error(
      "HOSTNAME must be an explicit host without shell or URL syntax.",
    );
  environment.NEXT_TELEMETRY_DISABLED = "1";
  validateDeploymentEnv("website", environment);
  return environment;
}

export async function websiteRunnerEnvironment(root, inherited = process.env) {
  await readyRunnerRoot(root);
  return publicWebsiteEnvironment(inherited);
}

function isolatedOrigin(value) {
  const url = validateOrigin(value, false);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port)
    throw new Error(
      "Synthetic runners require exact HTTP IPv4 loopback origins with explicit ports.",
    );
  return url;
}

export async function syntheticRunnerInputs(root, inherited = process.env) {
  await readyRunnerRoot(root);
  if (inherited?.KERNEL_SYNTHETIC_ENV !== "1")
    throw new Error("Synthetic runners require KERNEL_SYNTHETIC_ENV=1.");
  const websiteEnvironment = publicWebsiteEnvironment(inherited);
  const api = isolatedOrigin(websiteEnvironment.API_BASE_URL);
  const website = isolatedOrigin(
    requiredString(websiteEnvironment, "WEBSITE_URL"),
  );
  if (
    websiteEnvironment.HOSTNAME !== "127.0.0.1" ||
    websiteEnvironment.PORT !== website.port ||
    websiteEnvironment.WEBSITE_INDEXING_ENABLED !== "false" ||
    website.port === api.port
  )
    throw new Error(
      "Synthetic website/API ports must be distinct, match PORT, bind IPv4 loopback and disable indexing explicitly.",
    );
  websiteEnvironment.KERNEL_SYNTHETIC_ENV = "1";
  const apiEnvironment = { ...websiteEnvironment, PORT: api.port };
  return {
    websiteOrigin: website.origin,
    apiOrigin: api.origin,
    websiteEnvironment,
    apiEnvironment,
  };
}

const readJson = async (filename) =>
  JSON.parse((await readArtifactFile(filename)).toString("utf8"));

export async function resolveNextCli(root) {
  const directory = await readyRunnerRoot(root);
  const manifest = await readJson(path.join(directory, "package.json"));
  const lock = await readJson(path.join(directory, "package-lock.json"));
  const installed = await readJson(
    path.join(directory, "node_modules/next/package.json"),
  );
  const version = manifest?.dependencies?.next;
  if (
    manifest?.name !== "kernel-website" ||
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version) ||
    lock?.lockfileVersion !== 3 ||
    lock?.packages?.[""]?.name !== "kernel-website" ||
    lock?.packages?.[""]?.dependencies?.next !== version ||
    lock?.packages?.["node_modules/next"]?.version !== version ||
    installed?.name !== "next" ||
    installed?.version !== version
  )
    throw new Error(
      "Next CLI must be a root-owned installed next package matching the exact manifest and lock version.",
    );
  return artifactFile(path.join(directory, "node_modules/next/dist/bin/next"));
}

export async function resolveApiFixture(root, inherited = process.env) {
  await readyRunnerRoot(root);
  const directory = apiRepository({
    KERNEL_SYNTHETIC_ENV: inherited?.KERNEL_SYNTHETIC_ENV,
    KERNEL_API_DIRECTORY: inherited?.KERNEL_API_DIRECTORY,
  });
  const entry = await artifactFile(
    path.join(directory, "scripts/test-website-api.mjs"),
  );
  return { directory, entry };
}
