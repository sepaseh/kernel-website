import { lstat, open, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  artifactFile,
  completeArtifactWork,
  ensureArtifactDirectory,
} from "./release-files.mjs";
import {
  readyRunnerRoot,
  resolveNextCli,
  syntheticRunnerInputs,
} from "./runner-inputs.mjs";
import {
  runOwnedProcess,
  runVerificationCli,
  startOwnedProcess,
} from "./runner-process.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const maximumExportBytes = 64 * 1024 * 1024;

async function writeGraph(owned, output, limit) {
  let bytes = 0;
  try {
    for await (const chunk of owned.child.stdout) {
      bytes += chunk.length;
      if (bytes > limit)
        throw new Error("Analyzer export exceeded its bounded output limit.");
      await output.writeFile(chunk);
    }
    if (!bytes) throw new Error("Analyzer export produced no graph data.");
  } catch (error) {
    try {
      await owned.stop();
    } catch (stopError) {
      throw new AggregateError(
        [error, stopError],
        "Analyzer output failed and its owned process could not stop.",
        { cause: stopError },
      );
    }
    throw error;
  }
}

async function requireClaimedOutput(filename, identity) {
  const current = await lstat(await artifactFile(filename));
  if (
    !current.isFile() ||
    current.isSymbolicLink() ||
    current.dev !== identity.dev ||
    current.ino !== identity.ino
  )
    throw new Error(
      "Owned analyzer output was replaced; refusing the result or cleanup.",
    );
}

async function exportGraph(directory, next, environment, signal, limit) {
  const parent = path.join(directory, ".lighthouseci/website");
  await ensureArtifactDirectory(parent);
  signal?.throwIfAborted();
  const filename = path.join(parent, "graph.jsonl");
  const output = await open(filename, "wx", 0o600);
  let identity;
  let completed = false;
  let owned;
  const errors = [];
  try {
    identity = await output.stat();
    owned = startOwnedProcess({
      command: process.execPath,
      args: [next, "analyze", "export", "--snapshot", "website"],
      cwd: directory,
      env: environment,
      signal,
      stdio: ["ignore", "pipe", "inherit"],
    });
    await completeArtifactWork([
      owned.completion,
      writeGraph(owned, output, limit),
    ]);
    await requireClaimedOutput(filename, identity);
    completed = true;
  } catch (error) {
    errors.push(error);
  }
  if (!completed) {
    try {
      await owned?.stop();
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    await output.close();
  } catch (error) {
    errors.push(error);
    completed = false;
  }
  if (!completed && identity) {
    try {
      await requireClaimedOutput(filename, identity);
      await rm(filename);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(
      errors,
      "Analyzer export or owned output cleanup failed.",
    );
  return filename;
}

export async function analyzeWebsitePerformance(
  root = repository,
  options = {},
) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Analyzer cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const inherited = options.environment ?? process.env;
  const exporting = options.exporting ?? false;
  const limit = options.maximumOutputBytes ?? maximumExportBytes;
  if (typeof exporting !== "boolean")
    throw new Error("Analyzer export selection must be an explicit boolean.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximumExportBytes)
    throw new Error("Analyzer output limit must be between 1 byte and 64 MiB.");
  const inputs = await syntheticRunnerInputs(directory, inherited);
  const next = await resolveNextCli(directory);
  signal?.throwIfAborted();
  if (exporting)
    return exportGraph(
      directory,
      next,
      inputs.websiteEnvironment,
      signal,
      limit,
    );
  await runOwnedProcess({
    command: process.execPath,
    args: [next, "analyze", "--output", "--snapshot", "website"],
    cwd: directory,
    env: inputs.websiteEnvironment,
    signal,
  });
}

await runVerificationCli(import.meta.main, repository, async ({ signal }) => {
  const { values } = parseArgs({ options: { export: { type: "boolean" } } });
  const filename = await analyzeWebsitePerformance(repository, {
    exporting: values.export ?? false,
    signal,
  });
  if (filename)
    console.info(
      "Saved website analyzer graph to .lighthouseci/website/graph.jsonl.",
    );
});
