import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
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
export const insideArtifactRoot = (root, filename) => {
  const relative = path.relative(root, filename);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
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
export const artifactDirectory = (directory) => directoryPath(directory, false);
export const ensureArtifactDirectory = (directory) =>
  directoryPath(directory, true);
export async function artifactFile(value) {
  const filename = absolutePath(value);
  await artifactDirectory(path.dirname(filename));
  const entry = await lstat(filename);
  if (entry.isSymbolicLink() || !entry.isFile())
    throw new Error("Artifact input must be an unlinked regular file.");
  return filename;
}
export async function readArtifactFile(filename) {
  return readFile(await artifactFile(filename));
}
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

const assertCopySeparation = (source, destination) => {
  if (
    insideArtifactRoot(source, destination) ||
    insideArtifactRoot(destination, source)
  )
    throw new Error(
      "Artifact output must not overlap its physical input tree.",
    );
};

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

async function copyEntry(
  source,
  destination,
  sourceRoot,
  ancestors,
  skip,
  overwrite,
  destinationRoot,
) {
  const relative = path.relative(sourceRoot, source).split(path.sep).join("/");
  if (!insideArtifactRoot(sourceRoot, source))
    throw new Error("Artifact source must stay inside its declared tree.");
  if (skip.has(relative) || excludedArtifactPath(relative)) return;
  const resolved = await realpath(source);
  if (!insideArtifactRoot(sourceRoot, resolved))
    throw new Error("Cannot package a link outside its source tree.");
  if (excludedArtifactPath(path.relative(sourceRoot, resolved))) return;
  const entry = await lstat(resolved);
  if (entry.isDirectory()) {
    if (ancestors.has(resolved))
      throw new Error("Cannot package a circular directory link.");
    assertCopySeparation(resolved, await physicalOutputPath(destinationRoot));
    const nested = new Set(ancestors).add(resolved);
    await ensureArtifactDirectory(destination);
    await completeArtifactWork(
      (await readdir(resolved)).map((name) =>
        copyEntry(
          path.join(resolved, name),
          path.join(destination, name),
          sourceRoot,
          nested,
          skip,
          overwrite,
          destinationRoot,
        ),
      ),
    );
  } else if (entry.isFile()) {
    assertCopySeparation(resolved, destinationRoot);
    await ensureArtifactDirectory(path.dirname(destination));
    try {
      const existing = await lstat(destination);
      if (existing.isSymbolicLink() || !existing.isFile())
        throw new Error(
          "Artifact destination must be an unlinked regular file.",
        );
    } catch (error_) {
      if (error_.code !== "ENOENT") throw error_;
    }
    await copyFile(
      resolved,
      destination,
      overwrite ? 0 : constants.COPYFILE_EXCL,
    );
  } else throw new Error("Unsupported release file.");
}
export async function copyArtifactTree({
  source,
  destination,
  sourceRoot,
  skipPaths = [],
  overwrite = false,
}) {
  if (
    typeof overwrite !== "boolean" ||
    !Array.isArray(skipPaths) ||
    skipPaths.some((value) => typeof value !== "string")
  )
    throw new Error(
      "Artifact copy options must declare boolean overwrite and string skip paths.",
    );
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
  await copyEntry(from, target, root, new Set(), skip, overwrite, target);
}

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
