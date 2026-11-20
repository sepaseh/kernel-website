import {
  lstat,
  mkdtemp,
  readdir,
  readlink,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
  copyArtifactTree,
  readArtifactFile,
  requireApplicationReady,
  runDeliveryCommand,
} from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const postcssCopyLimits = { maxEntries: 4096, maxBytes: 16 * 1024 * 1024 };

/** Admit ordinary package bytes only; materialization must not introduce more links. */
async function regularPostcssTree(
  directory,
  budget = { entries: 0, bytes: 0 },
) {
  await artifactDirectory(directory);
  for (const name of await readdir(directory)) {
    const filename = path.join(directory, name);
    const entry = await lstat(filename);
    budget.entries++;
    if (budget.entries > postcssCopyLimits.maxEntries)
      throw new Error("PostCSS package exceeds its entry budget.");
    if (entry.isSymbolicLink())
      throw new Error("PostCSS package must not contain links.");
    if (entry.isDirectory()) await regularPostcssTree(filename, budget);
    else if (entry.isFile()) {
      budget.bytes += entry.size;
      if (budget.bytes > postcssCopyLimits.maxBytes)
        throw new Error("PostCSS package exceeds its byte budget.");
    } else throw new Error("PostCSS package must contain ordinary files only.");
  }
}

/** Preflight only Next's two generated PostCSS alias locations against their exact owned packages. */
async function postcssAliases(directory) {
  const aliases = [];
  for (const tree of [directory, path.join(directory, ".next/standalone")]) {
    const parent = await existingAssetDirectory(
      path.join(tree, ".next/node_modules"),
    );
    if (!parent) continue;
    const target = path.join(tree, "node_modules/postcss");
    for (const name of await readdir(parent)) {
      const alias = path.join(parent, name);
      const identity = await lstat(alias, { bigint: true });
      if (!identity.isSymbolicLink()) continue;
      if (!/^postcss-[0-9a-f]{16}$/.test(name))
        throw new Error("Unexpected generated dependency link.");
      const link = await readlink(alias);
      if (path.relative(target, path.resolve(parent, link)) !== "")
        throw new Error(
          "Generated PostCSS alias must target its exact package.",
        );
      await regularPostcssTree(target);
      const [metadata, lock] = await completeArtifactWork([
        readArtifactFile(path.join(target, "package.json")),
        readArtifactFile(path.join(directory, "package-lock.json")),
      ]);
      const installed = JSON.parse(metadata);
      const version =
        JSON.parse(lock).packages?.["node_modules/postcss"]?.version;
      if (
        typeof version !== "string" ||
        !version ||
        installed.name !== "postcss" ||
        installed.version !== version
      )
        throw new Error("Generated PostCSS package must match its root lock.");
      aliases.push({ alias, identity, link, target });
    }
  }
  return aliases;
}

const sameIdentity = (left, right) =>
  left.dev === right.dev && left.ino === right.ino;

/** Publish a bounded regular copy after checking the original junction still belongs to this build. */
async function materializePostcss({ alias, identity, link, target }) {
  const stage = await mkdtemp(
    path.join(path.dirname(alias), ".kernel-postcss-"),
  );
  const stageIdentity = await lstat(stage, { bigint: true });
  try {
    await copyArtifactTree({
      source: target,
      sourceRoot: target,
      destination: stage,
      ...postcssCopyLimits,
    });
    await regularPostcssTree(target);
    const current = await lstat(alias, { bigint: true });
    if (
      !current.isSymbolicLink() ||
      !sameIdentity(current, identity) ||
      (await readlink(alias)) !== link
    )
      throw new Error("Generated PostCSS alias changed before publication.");
    await artifactDirectory(stage);
    if (!sameIdentity(await lstat(stage, { bigint: true }), stageIdentity))
      throw new Error("PostCSS copy stage changed before publication.");
    await unlink(alias);
    await rename(stage, alias);
  } catch (error) {
    await completeArtifactWork([
      Promise.reject(error),
      (async () => {
        await artifactDirectory(stage);
        if (!sameIdentity(await lstat(stage, { bigint: true }), stageIdentity))
          throw new Error("PostCSS copy stage changed before cleanup.");
        await rm(stage, { recursive: true });
      })(),
    ]);
  }
}

/** Allows absent asset copies while rejecting linked entries and unsafe ancestors before cleanup. */
async function existingAssetDirectory(directory) {
  try {
    return await artifactDirectory(directory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

/**
 * Requires readiness and completed build inputs without building or running them.
 * Validates both asset destinations before replacing their previous copies, so
 * deleted source assets disappear while server and dependency siblings remain.
 * The caller owns these copy roots and must keep their paths stable during cleanup.
 */
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
  const aliases = await postcssAliases(directory);
  for (const alias of aliases) await materializePostcss(alias);
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
