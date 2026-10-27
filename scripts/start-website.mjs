import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareStandalone } from "./prepare-standalone.mjs";
import { requireApplicationReady } from "./release-files.mjs";
import { websiteRunnerEnvironment } from "./runner-inputs.mjs";
import { runOwnedProcess, runVerificationCli } from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

export async function startWebsite(options = {}) {
  const root = await requireApplicationReady(options.root ?? repository);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new Error("Website startup cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const environment = await websiteRunnerEnvironment(
    root,
    options.inherited ?? process.env,
  );
  const server = await prepareStandalone(root);
  signal?.throwIfAborted();
  return runOwnedProcess({
    args: [server],
    cwd: path.dirname(server),
    env: environment,
    signal,
    stdio: options.stdio ?? "inherit",
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  startWebsite({ signal }),
);
