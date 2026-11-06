import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolvePlaywrightCli } from "./browser-inputs.mjs";
import { packageRelease, parseReleaseArguments } from "./package-release.mjs";
import { ensureArtifactDirectory } from "./release-files.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
import { validateWorkflowTargets } from "./validate-workflow-targets.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const modes = new Set(["package", "smoke", "staging", "dast-context"]);

/** Prepare an exclusive exact-origin ZAP context after readiness and public target validation. */
export async function prepareDastContext(root, environment) {
  const directory = await readyRunnerRoot(root);
  const inputs = Object.fromEntries(
    ["DAST_TARGET", "DAST_ALLOWED_HOST", "DAST_PRODUCTION_HOST"].map((name) => [
      name,
      environment[name],
    ]),
  );
  validateWorkflowTargets("dast", inputs);
  const origin = new URL(inputs.DAST_TARGET).origin;
  const pattern = `(?i)^${origin.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/.*)?$`;
  const output = await ensureArtifactDirectory(
    path.join(directory, "test-results/dast"),
  );
  const filename = path.join(output, "authorized.context");
  await writeFile(
    filename,
    `<?xml version="1.0" encoding="UTF-8"?>\n<configuration><context><name>authorized-dast</name><inscope>true</inscope><incregexes>${pattern}</incregexes><tech><include>Db</include><include>Language</include><include>OS</include><include>SCM</include><include>WS</include></tech></context></configuration>\n`,
    { flag: "wx", mode: 0o644 },
  );
  return filename;
}

function runtimeEnvironment(inherited) {
  const environment = {};
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) {
    const value = inherited[key];
    if (value !== undefined) {
      if (typeof value !== "string" || /[\0\r\n]/.test(value))
        throw new Error("Operational runtime inputs must be public strings.");
      environment[key] = value;
    }
  }
  if (inherited.CI !== undefined && typeof inherited.CI !== "string")
    throw new Error("CI must be an explicit string marker.");
  return {
    ...environment,
    CI: inherited.CI ? "1" : "",
    NODE_ENV: "production",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  };
}

/** Validate explicit authorized targets and forward only public SDK inputs. */
export async function operationsBrowserEnvironment(root, mode, inherited) {
  await readyRunnerRoot(root);
  if (mode !== "smoke" && mode !== "staging")
    throw new Error("Expected smoke or staging operational browser mode.");
  if (!inherited || typeof inherited !== "object" || Array.isArray(inherited))
    throw new Error("Operational environment must be an explicit object.");
  const prefix = mode.toUpperCase();
  const targets = Object.fromEntries(
    [
      "ALLOWED_API_HOST",
      "ALLOWED_APP_HOST",
      "API_HEALTH_URL",
      "BASE_URL",
      ...(mode === "smoke" ? ["DEPLOYMENT_ID", "EXPECTED_DEPLOYMENT_ID"] : []),
    ].map((key) => [prefix + "_" + key, inherited[prefix + "_" + key]]),
  );
  validateWorkflowTargets(mode, targets);
  return { ...runtimeEnvironment(inherited), ...targets };
}

/** Execute one explicitly selected manual operation; never included in full. */
export async function runOperationsCheck(root, mode, options = {}) {
  const directory = await readyRunnerRoot(root);
  if (!modes.has(mode)) throw new Error("Unknown operational check.");
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error("Operational cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const args = options.arguments ?? [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string"))
    throw new Error("Operational arguments must be explicit strings.");
  if (mode === "package")
    return (options.package ?? packageRelease)({
      repositoryRoot: directory,
      releaseId: parseReleaseArguments(args),
    });
  if (mode === "dast-context") {
    if (args.length)
      throw new Error("DAST context preparation accepts no extra arguments.");
    return prepareDastContext(directory, options.environment ?? process.env);
  }
  if (args.length)
    throw new Error("Browser operations accept no extra arguments.");
  const environment = await operationsBrowserEnvironment(
    directory,
    mode,
    options.environment ?? process.env,
  );
  const cli = await resolvePlaywrightCli(directory);
  return (options.execute ?? runOwnedProcess)({
    args: [
      cli,
      "test",
      "--config=" + path.join(directory, "playwright." + mode + ".config.ts"),
    ],
    cwd: directory,
    env: environment,
    signal,
    stdio: "inherit",
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runOperationsCheck(repository, process.argv[2], {
    arguments: process.argv.slice(3),
    signal,
  }),
);
