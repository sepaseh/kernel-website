import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
  copyArtifactTree,
  requireApplicationReady,
  runDeliveryCommand,
} from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

async function existingAssetDirectory(directory) {
  try {
    return await artifactDirectory(directory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

export async function prepareStandalone(root = repository) {
  const directory = await requireApplicationReady(root);
  const destination = path.join(directory, ".next/standalone");
  await completeArtifactWork([
    artifactFile(path.join(directory, ".next/BUILD_ID")),
    artifactFile(path.join(destination, "server.js")),
    artifactDirectory(path.join(directory, "public")),
    artifactDirectory(path.join(directory, ".next/static")),
  ]);
  const existing = await completeArtifactWork(
    ["public", ".next/static"].map((name) =>
      existingAssetDirectory(path.join(destination, name)),
    ),
  );
  await completeArtifactWork(
    existing
      .filter((directory) => directory !== undefined)
      .map((directory) => rm(directory, { recursive: true })),
  );
  await completeArtifactWork([
    copyArtifactTree({
      source: path.join(directory, "public"),
      destination: path.join(destination, "public"),
      sourceRoot: path.join(directory, "public"),
      overwrite: true,
    }),
    copyArtifactTree({
      source: path.join(directory, ".next/static"),
      destination: path.join(destination, ".next/static"),
      sourceRoot: path.join(directory, ".next/static"),
      overwrite: true,
    }),
  ]);
  return path.join(destination, "server.js");
}
await runDeliveryCommand(import.meta.main, repository, () =>
  prepareStandalone(repository),
);
