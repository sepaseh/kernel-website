import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const excludedDirectories = new Set([
  ".git",
  ".aws",
  ".ssh",
  ".storybook",
  ".turbo",
  "__mocks__",
  "__snapshots__",
  "__tests__",
  "coverage",
  "docs",
  "e2e",
  "playwright-report",
  "project-reference",
  "secrets",
  "storybook-static",
  "test",
  "test-results",
  "tests",
]);
/** Tests lexical containment, including the root itself; it does not resolve links. */
export const insideArtifactRoot = (root, filename) => {
  const relative = path.relative(root, filename);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
/** Requires an explicit absolute local path before normalizing its segments. */
const absolutePath = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    !path.isAbsolute(value) ||
    /^[\\/]{2}/.test(value) ||
    /[\0\r\n]/.test(value)
  )
    throw new Error("Artifact paths must be explicit absolute local paths.");
  return path.resolve(value);
};

/** Checks ancestors before descending or creating children; existing links always fail. */
async function directoryPath(value, create) {
  const directory = absolutePath(value);
  const parent = path.dirname(directory);
  if (parent !== directory) await directoryPath(parent, create);
  let entry;
  try {
    entry = await lstat(directory);
  } catch (error_) {
    if (!create || error_.code !== "ENOENT") throw error_;
    try {
      await mkdir(directory);
    } catch (error_) {
      if (error_.code !== "EEXIST") throw error_;
    }
    entry = await lstat(directory);
  }
  if (entry.isSymbolicLink() || !entry.isDirectory())
    throw new Error(
      "Artifact directories must not contain links or non-directory ancestors.",
    );
  return directory;
}
/** Requires an existing directory with an entirely unlinked directory ancestry. */
export const artifactDirectory = (directory) => directoryPath(directory, false);
/** Creates missing directories in parent-to-child order while validating each entry. */
export const ensureArtifactDirectory = (directory) =>
  directoryPath(directory, true);
/** Validates the parent chain and rejects linked or non-regular input files. */
export async function artifactFile(value) {
  const filename = absolutePath(value);
  await artifactDirectory(path.dirname(filename));
  const entry = await lstat(filename);
  if (entry.isSymbolicLink() || !entry.isFile())
    throw new Error("Artifact input must be an unlinked regular file.");
  return filename;
}
/** Reads validated input bytes; the caller must keep the path stable between check and read. */
export async function readArtifactFile(filename) {
  return readFile(await artifactFile(filename));
}
/**
 * Requires the schema-one readiness marker before delivery operations access inputs.
 * A true marker grants this boundary only; it does not verify a build or deployment.
 */
export async function requireApplicationReady(root) {
  const directory = await artifactDirectory(root);
  const marker = JSON.parse(
    (
      await readArtifactFile(
        path.join(directory, ".github/bootstrap-policy.json"),
      )
    ).toString("utf8"),
  );
  if (marker?.schemaVersion !== 1 || marker.applicationReady !== true)
    throw new Error(
      "Delivery runtime activation requires applicationReady:true; this snapshot is non-runnable.",
    );
  return directory;
}

/** Filters known private, state and development file classes by path, without inspecting content. */
export function excludedArtifactPath(filename) {
  const segments = filename.replaceAll("\\", "/").split("/");
  const lower = segments.map((part) => part.toLowerCase());
  const name = segments.at(-1);
  return (
    lower.some(
      (part) => part.startsWith(".env") || excludedDirectories.has(part),
    ) ||
    lower.some(
      (part, index) =>
        (part === ".next" && lower[index + 1] === "cache") ||
        (part === "server" && lower[index + 1] === "data"),
    ) ||
    /\.(?:test|spec|stories)\.[^.]+$/i.test(name) ||
    /\.snap$/i.test(name) ||
    /\.(?:sqlite3?|db)$/i.test(name) ||
    /\.(?:sqlite3?|db)-(?:wal|shm|journal)$/i.test(name) ||
    /\.(?:pem|key|p12|pfx)$/i.test(name) ||
    /^(?:id_rsa|id_ed25519|credentials(?:\.json)?|\.npmrc|\.netrc|\.pypirc)$/i.test(
      name,
    )
  );
}

/**
 * Waits for every started owner before reporting failures. A single failure is
 * rethrown unchanged; multiple failures retain input order and the first as cause.
 */
export async function completeArtifactWork(operations) {
  const results = await Promise.allSettled(operations);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      failures
        .map((error) =>
          error instanceof Error ? error.message : "Artifact operation failed.",
        )
        .join("\n"),
      { cause: failures[0] },
    );
  return results.map((result) => result.value);
}

/** Rejects overlap in either direction between the caller's resolved input and output. */
const assertCopySeparation = (source, destination) => {
  if (
    insideArtifactRoot(source, destination) ||
    insideArtifactRoot(destination, source)
  )
    throw new Error(
      "Artifact output must not overlap its physical input tree.",
    );
};

/**
 * Resolves existing output segments without creating them, rejecting links and
 * non-directory ancestors. Missing segments remain available for later creation.
 */
async function physicalOutputPath(value, directory = false) {
  const absolute = absolutePath(value);
  const parent = path.dirname(absolute);
  const resolvedParent =
    parent === absolute ? parent : await physicalOutputPath(parent, true);
  const filename =
    parent === absolute
      ? absolute
      : path.join(resolvedParent, path.basename(absolute));
  let entry;
  try {
    entry = await lstat(filename);
  } catch (error_) {
    if (error_.code === "ENOENT") return filename;
    throw error_;
  }
  if (entry.isSymbolicLink() || (directory && !entry.isDirectory()))
    throw new Error(
      "Artifact output must not contain links or non-directory ancestors.",
    );
  return realpath(filename);
}

/**
 * Tracks ancestors per branch so sibling aliases remain valid. Sequential copies
 * share one budget and stop scheduling descendants as soon as any copy fails.
 */
async function copyDirectoryEntry(source, destination, ancestors, context) {
  if (ancestors.has(source))
    throw new Error("Cannot package a circular directory link.");
  assertCopySeparation(
    source,
    await physicalOutputPath(context.destinationRoot),
  );
  const nested = new Set(ancestors).add(source);
  await ensureArtifactDirectory(destination);
  for (const name of await readdir(source))
    await copyEntry(
      path.join(source, name),
      path.join(destination, name),
      nested,
      context,
    );
}

/** Rejects unsafe destinations, then claims exclusively or replaces through a closed stage. */
async function copyFileEntry(source, destination, context) {
  const { overwrite, destinationRoot } = context;
  assertCopySeparation(source, destinationRoot);
  await ensureArtifactDirectory(path.dirname(destination));
  try {
    const existing = await lstat(destination);
    if (existing.isSymbolicLink() || !existing.isFile())
      throw new Error("Artifact destination must be an unlinked regular file.");
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
  }
  if (overwrite) await replaceArtifactFile(source, destination);
  else await copyFile(source, destination, constants.COPYFILE_EXCL);
}

/**
 * Streams into an exclusively claimed sibling stage, preserves source permissions
 * and closes both handles before rename. Failure attempts to remove that stage;
 * its pathname and ancestors must remain under trusted single-writer ownership.
 */
async function replaceArtifactFile(source, destination) {
  const staged = path.join(
    path.dirname(destination),
    `.kernel-copy-${randomUUID()}.partial`,
  );
  const output = await open(staged, "wx", 0o600);
  let published = false;
  try {
    try {
      const input = await open(source, "r");
      try {
        const { mode } = await input.stat();
        for await (const chunk of input.createReadStream({ autoClose: false }))
          await output.writeFile(chunk);
        await output.chmod(mode & 0o7777);
      } finally {
        await input.close();
      }
    } finally {
      await output.close();
    }
    await rename(staged, destination);
    published = true;
  } finally {
    if (!published) await rm(staged, { force: true });
  }
}

/** Checks logical and resolved paths, charging shared entry visits and copied source-file sizes. */
async function copyEntry(source, destination, ancestors, context) {
  const { sourceRoot, skip, budget } = context;
  const relative = path.relative(sourceRoot, source).split(path.sep).join("/");
  if (!insideArtifactRoot(sourceRoot, source))
    throw new Error("Artifact source must stay inside its declared tree.");
  if (skip.has(relative) || excludedArtifactPath(relative)) return;
  if (++budget.entries > budget.maxEntries)
    throw new Error("Artifact copy exceeds its total entry budget.");
  const resolved = await realpath(source);
  if (!insideArtifactRoot(sourceRoot, resolved))
    throw new Error("Cannot package a link outside its source tree.");
  if (excludedArtifactPath(path.relative(sourceRoot, resolved))) return;
  const entry = await lstat(resolved);
  if (entry.isDirectory()) {
    await copyDirectoryEntry(resolved, destination, ancestors, context);
  } else if (entry.isFile()) {
    budget.bytes += entry.size;
    if (budget.bytes > budget.maxBytes)
      throw new Error("Artifact copy exceeds its total byte budget.");
    await copyFileEntry(resolved, destination, context);
  } else throw new Error("Unsupported release file.");
}
/**
 * Copies a disjoint owned tree, materializing internal links and rejecting escapes
 * and cycles. Shared limits default to 100,000 entry visits and 1 GiB of source-file
 * sizes, counting repeated aliases. Failures may leave partial output for its owner.
 * Paths must remain stable: validation and filesystem operations are not atomic.
 */
export async function copyArtifactTree({
  source,
  destination,
  sourceRoot,
  skipPaths = [],
  overwrite = false,
  maxEntries = 100_000,
  maxBytes = 1024 * 1024 * 1024,
}) {
  if (
    typeof overwrite !== "boolean" ||
    !Array.isArray(skipPaths) ||
    skipPaths.some((value) => typeof value !== "string")
  )
    throw new Error(
      "Artifact copy options must declare boolean overwrite and string skip paths.",
    );
  if (
    !Number.isSafeInteger(maxEntries) ||
    maxEntries < 1 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  )
    throw new Error("Artifact copy budgets must be positive safe integers.");
  const root = await artifactDirectory(sourceRoot);
  const from = absolutePath(source);
  if (!insideArtifactRoot(root, from))
    throw new Error("Artifact source must stay inside its declared tree.");
  const relative = path.relative(root, from).split(path.sep).join("/");
  const skip = new Set(skipPaths);
  if (skip.has(relative) || excludedArtifactPath(relative)) return;
  const resolved = await realpath(from);
  if (!insideArtifactRoot(root, resolved))
    throw new Error("Cannot package a link outside its source tree.");
  if (excludedArtifactPath(path.relative(root, resolved))) return;
  const target = await physicalOutputPath(destination);
  assertCopySeparation(resolved, target);
  await copyEntry(from, target, new Set(), {
    sourceRoot: root,
    skip,
    overwrite,
    destinationRoot: target,
    budget: { entries: 0, bytes: 0, maxEntries, maxBytes },
  });
}

/**
 * Keeps supported-runtime imports inert and gates main-entry callbacks on readiness.
 * Unsupported runtimes and CLI failures set exitCode instead of escaping as errors.
 */
export async function runDeliveryCommand(main, root, action) {
  if (typeof main !== "boolean") {
    console.error(
      "Delivery tools require the repository's Node.js 24 runtime.",
    );
    process.exitCode = 1;
  } else if (main) {
    try {
      await requireApplicationReady(root);
      await action();
    } catch (error_) {
      console.error(
        error_ instanceof Error ? error_.message : "Delivery operation failed.",
      );
      process.exitCode = 1;
    }
  }
}

await runDeliveryCommand(import.meta.main, repository, async () => {
  console.info(
    "Application readiness metadata permits delivery tooling; this is not deployment verification.",
  );
});
