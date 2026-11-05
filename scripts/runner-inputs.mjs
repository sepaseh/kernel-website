import path from "node:path";

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

/**
 * Gate runner work on declared readiness and reject runtime dotenv presence
 * before callers read operation settings, resolve tools, write files or spawn.
 */
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

/**
 * Copy only validated process-location settings needed to launch local tools,
 * leaving unrelated operator settings and launch hooks unread.
 */
function runtimeEnvironment(inherited) {
  const environment = {};
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) {
    const value = inherited?.[key];
    if (typeof value === "string" && value && !/[\0\r\n]/.test(value))
      environment[key] = value;
  }
  return environment;
}

/**
 * Build a new child environment from runtime essentials and validated public
 * website settings, with explicit host/port values and telemetry disabled.
 */
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

/**
 * Validate the selected root before reading inherited public settings and
 * return a separate allowlisted environment without changing the input.
 */
export async function websiteRunnerEnvironment(root, inherited = process.env) {
  await readyRunnerRoot(root);
  return publicWebsiteEnvironment(inherited);
}

/**
 * Require a bare HTTP IPv4 loopback origin with a retained explicit port for
 * isolated synthetic services.
 */
function isolatedOrigin(value) {
  const url = validateOrigin(value, false);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port)
    throw new Error(
      "Synthetic runners require exact HTTP IPv4 loopback origins with explicit ports.",
    );
  return url;
}

/**
 * After readiness, require synthetic opt-in, disabled indexing and separate
 * loopback website/API ports. Return independent child environments with each
 * service's own PORT and the validated public website origin.
 */
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

/**
 * After readiness, resolve an unlinked CLI inside the selected website only
 * when its manifest, lockfile and installed Next package agree exactly.
 */
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

/**
 * After readiness and explicit synthetic opt-in, select the website-owned local
 * HTTP fixture entry without consulting external source trees or Git state.
 */
export async function resolveApiFixture(root, inherited = process.env) {
  const directory = await readyRunnerRoot(root);
  if (inherited?.KERNEL_SYNTHETIC_ENV !== "1")
    throw new Error(
      "The local HTTP test fixture requires KERNEL_SYNTHETIC_ENV=1.",
    );
  const entry = await artifactFile(
    path.join(directory, "scripts/website-api-fixture.mjs"),
  );
  return { directory, entry };
}
