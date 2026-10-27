import { fileURLToPath } from "node:url";

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
  const { apiEnvironment } = await syntheticRunnerInputs(root, inherited);
  const { directory, entry } = await resolveApiFixture(root, inherited);
  return runOwnedProcess({
    args: [entry],
    cwd: directory,
    env: apiEnvironment,
    signal,
    stdio: options.stdio ?? "inherit",
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runWebsiteApi({ signal }),
);
