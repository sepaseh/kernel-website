import { fileURLToPath } from "node:url";

import { requireApplicationReady } from "./release-files.mjs";
import { resolveApiFixture, syntheticRunnerInputs } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";
const repository = fileURLToPath(new URL("../", import.meta.url));
export async function runWebsiteApi(options = {}) {
  const root = await requireApplicationReady(options.root ?? repository);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error("HTTP fixture cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const inherited = options.inherited ?? process.env;
  const inputs = await syntheticRunnerInputs(root, inherited);
  const { directory, entry } = await resolveApiFixture(root, inherited);
  const environment = {};
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP"]) {
    const value = inputs.apiEnvironment[key];
    if (value !== undefined) environment[key] = value;
  }
  Object.assign(environment, {
    NODE_ENV: "test",
    KERNEL_SYNTHETIC_ENV: "1",
    PORT: inputs.apiEnvironment.PORT,
    WEBSITE_URL: inputs.websiteOrigin,
  });
  return runOwnedProcess({
    args: [entry],
    cwd: directory,
    env: environment,
    signal,
    stdio: options.stdio ?? "inherit",
  });
}
await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runWebsiteApi({ signal }),
);
