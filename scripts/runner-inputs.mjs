import childProcess from "node:child_process";
import path from "node:path";

import { apiRepository } from "./api-repository.mjs";
import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
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

export const apiFixtureRevision = "4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9";

const systemGit =
  process.platform === "win32"
    ? "C:\\Program Files\\Git\\cmd\\git.exe"
    : "/usr/bin/git";
const gitEnvironment = () =>
  process.platform === "win32"
    ? {
        PATH: "C:\\Program Files\\Git\\cmd;C:\\Windows\\System32",
        SystemRoot: "C:\\Windows",
      }
    : { PATH: "/usr/bin:/bin" };

async function gitOutput(directory, args) {
  await artifactFile(systemGit);
  return new Promise((resolve, reject) => {
    childProcess.execFile(
      systemGit,
      [
        "--no-optional-locks",
        "--no-replace-objects",
        "-C",
        directory,
        "-c",
        "core.fsmonitor=false",
        ...args,
      ],
      {
        encoding: "utf8",
        env: gitEnvironment(),
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
        windowsHide: true,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout.trim())),
    );
  });
}

async function verifyApiInstallation(directory) {
  const manifest = await readJson(path.join(directory, "package.json"));
  const lock = await readJson(path.join(directory, "package-lock.json"));
  const dependencies = manifest.dependencies;
  const declared = lock?.packages?.[""];
  if (
    manifest.name !== "kernel-api" ||
    !dependencies ||
    typeof dependencies !== "object" ||
    Array.isArray(dependencies) ||
    lock?.lockfileVersion !== 3 ||
    declared?.name !== "kernel-api" ||
    Object.keys(dependencies).length !==
      Object.keys(declared.dependencies ?? {}).length ||
    Object.entries(dependencies).some(
      ([name, version]) => declared.dependencies?.[name] !== version,
    )
  )
    throw new Error("API fixture manifest and lock identity must match.");
  const names = Object.keys(dependencies);
  if (names.some((name) => !/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(name)))
    throw new Error("API fixture dependency names must be ordinary packages.");
  await completeArtifactWork(
    names.map(async (name) => {
      const installed = await readJson(
        path.join(directory, "node_modules", name, "package.json"),
      );
      const expected = lock.packages[`node_modules/${name}`]?.version;
      if (
        typeof expected !== "string" ||
        installed.name !== name ||
        installed.version !== expected
      )
        throw new Error(
          "API fixture dependencies must match their installed lock versions.",
        );
    }),
  );
}

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
  await artifactDirectory(path.join(directory, ".git"));
  const top = await gitOutput(directory, ["rev-parse", "--show-toplevel"]);
  const revision = await gitOutput(directory, ["rev-parse", "HEAD"]);
  const changes = await gitOutput(directory, [
    "status",
    "--porcelain=v1",
    "--untracked-files=no",
    "--ignore-submodules=none",
  ]);
  if (
    path.resolve(top) !== directory ||
    revision !== apiFixtureRevision ||
    changes
  )
    throw new Error(
      "API fixture must be a clean independent checkout of the pinned revision.",
    );
  await verifyApiInstallation(directory);
  const entry = await artifactFile(path.join(directory, "src/index.ts"));
  return { directory, entry, revision };
}
