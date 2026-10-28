import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { requireApplicationReady } from "./release-files.mjs";
import { resolveApiFixture, syntheticRunnerInputs } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

export async function runWebsiteApi(options = {}) {
  const root = await requireApplicationReady(options.root ?? repository);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error("API fixture cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const inherited = options.inherited ?? process.env;
  const inputs = await syntheticRunnerInputs(root, inherited);
  const { directory, entry, revision } = await resolveApiFixture(
    root,
    inherited,
  );
  const parent = await realpath(os.tmpdir());
  const state = await realpath(
    await mkdtemp(path.join(parent, "website-api-state-")),
  );
  let primaryFailure;
  let result;
  try {
    const environment = {};
    for (const key of ["PATH", "SystemRoot"]) {
      const value = inputs.apiEnvironment[key];
      if (value !== undefined) environment[key] = value;
    }
    Object.assign(environment, {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: inputs.apiEnvironment.PORT,
      BETTER_AUTH_URL: inputs.apiOrigin,
      SERVER_ALLOWED_ORIGIN: inputs.websiteOrigin,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      DATABASE_URL: pathToFileURL(path.join(state, "api.sqlite")).href,
      LOCAL_STORAGE_PATH: path.join(state, "objects"),
      SERVER_SEED_DEVELOPMENT_DATA: "true",
      OTP_FIXED_CODE: "123456",
      STORAGE_DRIVER: "local",
      SERVER_ENVIRONMENT: "website-synthetic",
      SERVER_RELEASE_ID: revision,
      LOG_LEVEL: "error",
      TEMP: state,
      TMP: state,
    });
    result = await runOwnedProcess({
      args: [entry],
      cwd: directory,
      env: environment,
      signal,
      stdio: options.stdio ?? "inherit",
    });
  } catch (error) {
    primaryFailure = error;
  }
  try {
    if (
      path.dirname(state) !== parent ||
      !path.basename(state).startsWith("website-api-state-")
    )
      throw new Error(
        "API fixture cleanup target is outside its owned temporary state.",
      );
    await rm(state, { recursive: true, force: true });
  } catch (error) {
    if (primaryFailure)
      throw new AggregateError(
        [primaryFailure, error],
        "API fixture and owned state cleanup both failed.",
        { cause: error },
      );
    throw error;
  }
  if (primaryFailure) throw primaryFailure;
  return result;
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runWebsiteApi({ signal }),
);
