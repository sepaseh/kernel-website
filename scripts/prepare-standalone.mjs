import {
  lstat,
  mkdtemp,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
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
const postcssStagePrefix = ".kernel-postcss-";

/** Admit ordinary package bytes and count the root as the copy does. */
async function regularPostcssTree(
  directory,
  budget = { entries: 1, bytes: 0 },
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

async function readPostcssAlias(directory, parent, name, target) {
  const alias = path.join(parent, name);
  const identity = await lstat(alias, { bigint: true });
  if (!identity.isSymbolicLink()) return undefined;
  if (!/^postcss-[0-9a-f]{16}$/.test(name))
    throw new Error("Unexpected generated dependency link.");

  const link = await readlink(alias);
  if (path.relative(target, path.resolve(parent, link)) !== "")
    throw new Error("Generated PostCSS alias must target its exact package.");

  await regularPostcssTree(target);
  const [resolvedAlias, resolvedTarget] = await completeArtifactWork([
    realpath(alias),
    realpath(target),
  ]);
  if (path.relative(resolvedTarget, resolvedAlias) !== "")
    throw new Error("Generated PostCSS alias must target its exact package.");

  const [metadata, lock] = await completeArtifactWork([
    readArtifactFile(path.join(target, "package.json")),
    readArtifactFile(path.join(directory, "package-lock.json")),
  ]);
  const installed = JSON.parse(metadata);
  const version = JSON.parse(lock).packages?.["node_modules/postcss"]?.version;
  if (
    typeof version !== "string" ||
    !version ||
    installed.name !== "postcss" ||
    installed.version !== version
  )
    throw new Error("Generated PostCSS package must match its root lock.");
  return { alias, identity, link, target };
}

async function postcssAliasesInTree(directory, tree) {
  const parent = await existingAssetDirectory(
    path.join(tree, ".next/node_modules"),
  );
  if (!parent) return [];

  const names = await readdir(parent);
  if (names.some((name) => name.startsWith(postcssStagePrefix)))
    throw new Error(
      "An unfinished PostCSS replacement requires a clean build.",
    );

  const target = path.join(tree, "node_modules/postcss");
  const aliases = await completeArtifactWork(
    names.map((name) => readPostcssAlias(directory, parent, name, target)),
  );
  return aliases.filter((alias) => alias !== undefined);
}

/** Preflight both generated dependency trees before changing either one. */
async function postcssAliases(directory) {
  const buildAliases = await postcssAliasesInTree(directory, directory);
  const standaloneAliases = await postcssAliasesInTree(
    directory,
    path.join(directory, ".next/standalone"),
  );
  return [...buildAliases, ...standaloneAliases];
}

const sameIdentity = (left, right) =>
  left.dev === right.dev && left.ino === right.ino;

async function assertOwnedPostcssAlias(filename, identity, link) {
  const current = await lstat(filename, { bigint: true });
  if (
    !current.isSymbolicLink() ||
    !sameIdentity(current, identity) ||
    (await readlink(filename)) !== link
  )
    throw new Error("Generated PostCSS alias changed during publication.");
}

async function assertOwnedPostcssStage(stage, identity) {
  await artifactDirectory(stage);
  if (!sameIdentity(await lstat(stage, { bigint: true }), identity))
    throw new Error("PostCSS copy stage changed during publication.");
}

async function restorePostcssAlias(backup, alias, identity, link) {
  await assertOwnedPostcssAlias(backup, identity, link);
  try {
    await lstat(alias);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await rename(backup, alias);
    return;
  }
  throw new Error(
    "Cannot restore a PostCSS alias over an occupied destination.",
  );
}

/** Publish a bounded regular copy after checking the original junction still belongs to this build. */
async function materializePostcss({ alias, identity, link, target }) {
  const stage = await mkdtemp(
    path.join(path.dirname(alias), postcssStagePrefix),
  );
  const stageIdentity = await lstat(stage, { bigint: true });
  const replacement = path.join(stage, "package");
  const backup = path.join(stage, "original");
  let backedUp = false;

  const finishStage = async (restore) => {
    await assertOwnedPostcssStage(stage, stageIdentity);
    if (restore) await restorePostcssAlias(backup, alias, identity, link);
    await rm(stage, { recursive: true, maxRetries: 3 });
  };

  try {
    await copyArtifactTree({
      source: target,
      sourceRoot: target,
      destination: replacement,
      ...postcssCopyLimits,
    });
    await regularPostcssTree(target);
    await artifactDirectory(replacement);
    await assertOwnedPostcssStage(stage, stageIdentity);
    await assertOwnedPostcssAlias(alias, identity, link);
    await rename(alias, backup);
    backedUp = true;
    await rename(replacement, alias);
  } catch (error) {
    await completeArtifactWork([Promise.reject(error), finishStage(backedUp)]);
    return;
  }

  await finishStage(false);
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
