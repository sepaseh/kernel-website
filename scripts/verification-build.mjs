import { createHash } from "node:crypto";
import {
  lstat,
  mkdtemp,
  open,
  readdir,
  rename,
  rm,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import {
  artifactDirectory,
  artifactFile,
  ensureArtifactDirectory,
} from "./release-files.mjs";
import { readyRunnerRoot, syntheticRunnerInputs } from "./runner-inputs.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const recordPath = "coverage/verification-build.json";
const sourcePolicy = ".github/bootstrap-policy.json";
const sourceLimit = 32 * 1024 * 1024;
const outputLimit = 256 * 1024 * 1024;
const totalLimit = 2 * 1024 * 1024 * 1024;
const entryLimit = 100_000;
const examples = new Set([
  ".env.example",
  "deploy/docker/compose.env.example",
  "deploy/native/nginx.env.example",
  "deploy/native/website.env.example",
]);
const caches = new Set([
  ".next/cache",
  ".next/standalone/.next/cache",
  ".next/standalone/.next/server/route-cache",
]);
const privateSegments = new Set([
  ".git",
  ".aws",
  ".ssh",
  ".next",
  "node_modules",
  "coverage",
  "test-results",
  "secrets",
]);
const generatedRoots = new Set([
  ".git",
  "node_modules",
  "coverage",
  ".next",
  "playwright-report",
  "test-results",
  "dist",
  ".lighthouseci",
]);
const compareStrings = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};
const insist = (condition, message) => {
  if (!condition) throw new Error(message);
};
const cancellationSignal = (options) => {
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Verification cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  return signal;
};
const cancellationFailure = (error, signal) =>
  signal?.aborted && error?.name === "AbortError" && error.code === "ABORT_ERR"
    ? signal.reason
    : error;

async function completeWork(operations, signal) {
  const results = await Promise.allSettled(operations);
  const failures = [
    ...new Set(
      results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    ),
  ];
  if (
    signal?.aborted &&
    !failures.some(
      (failure) =>
        failure === signal.reason ||
        (failure instanceof AggregateError &&
          failure.errors.includes(signal.reason)),
    )
  )
    failures.unshift(signal.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Verification work failed", {
      cause: failures[0],
    });
  return results.map((result) => result.value);
}
const relativePath = (value) => {
  insist(
    typeof value === "string" &&
      !/[\\:\0\r\n]/.test(value) &&
      !value.split("/").some((part) => !part || part === "." || part === ".."),
    "Verification paths must be safe relative paths.",
  );
  return value;
};
const publicSourcePath = (filename) => {
  relativePath(filename);
  const segments = filename.toLowerCase().split("/");
  insist(
    !segments.some(
      (part) => part.startsWith(".env") || privateSegments.has(part),
    ) &&
      !/\.(?:pem|key|p12|pfx|sqlite3?|db)$/i.test(filename) &&
      !/(?:^|\/)(?:settings\.local\.json|credentials(?:\.json)?|\.npmrc|\.netrc)$/i.test(
        filename,
      ) &&
      !/^server\/data(?:\/|$)/i.test(filename),
    "Private or generated files cannot supply verification source.",
  );
  return filename;
};
const sameFile = (left, right) =>
  ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every(
    (key) => left[key] === right[key],
  );

async function fileState(directory, relative, file, maximum, signal) {
  signal?.throwIfAborted();
  const filename = await artifactFile(
    path.join(directory, relativePath(relative)),
  );
  const [entry, current] = await completeWork(
    [lstat(filename), file.stat()],
    signal,
  );
  insist(
    current.isFile() &&
      Number.isSafeInteger(current.size) &&
      current.size >= 0 &&
      current.size <= maximum &&
      sameFile(entry, current),
    "Verification input must remain an ordinary bounded file.",
  );
  return current;
}

async function readSmall(directory, relative, signal) {
  signal?.throwIfAborted();
  await using file = await open(
    await artifactFile(path.join(directory, relativePath(relative))),
    "r",
  );
  const before = await fileState(
    directory,
    relative,
    file,
    sourceLimit,
    signal,
  );
  let bytes;
  try {
    bytes = await file.readFile({ signal });
  } catch (error) {
    throw cancellationFailure(error, signal);
  }
  const after = await fileState(directory, relative, file, sourceLimit, signal);
  insist(
    bytes.length === before.size && sameFile(before, after),
    "Verification input changed while reading.",
  );
  return bytes;
}

async function hashFile(directory, relative, maximum, budget, signal) {
  signal?.throwIfAborted();
  await using file = await open(
    await artifactFile(path.join(directory, relativePath(relative))),
    "r",
  );
  const before = await fileState(directory, relative, file, maximum, signal);
  budget.bytes += before.size;
  insist(
    budget.bytes <= totalLimit,
    "Verification files exceed the total byte budget.",
  );
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of file.createReadStream({
      autoClose: false,
      signal,
    })) {
      signal?.throwIfAborted();
      bytes += chunk.length;
      insist(bytes <= before.size, "Verification input grew while hashing.");
      digest.update(chunk);
    }
  } catch (error) {
    throw cancellationFailure(error, signal);
  }
  const after = await fileState(directory, relative, file, maximum, signal);
  insist(
    bytes === before.size && sameFile(before, after),
    "Verification input changed while hashing.",
  );
  return { path: relative, bytes, sha256: digest.digest("hex") };
}

async function hashFiles(directory, paths, maximum, signal) {
  const budget = { bytes: 0 };
  const files = [];
  // Batches bound open handles while preserving deterministic input ordering.
  for (let index = 0; index < paths.length; index += 32) {
    signal?.throwIfAborted();
    files.push(
      ...(await completeWork(
        paths
          .slice(index, index + 32)
          .map((relative) =>
            hashFile(directory, relative, maximum, budget, signal),
          ),
        signal,
      )),
    );
  }
  return files;
}

async function inspectSource(directory, relative, inventory, budget, signal) {
  signal?.throwIfAborted();
  const entries = await readdir(path.join(directory, relative), {
    withFileTypes: true,
  });
  signal?.throwIfAborted();
  budget.entries += entries.length;
  insist(
    budget.entries <= entryLimit,
    "Verification source exceeds its entry budget.",
  );
  await completeWork(
    entries.map(async (entry) => {
      signal?.throwIfAborted();
      const filename = relative ? `${relative}/${entry.name}` : entry.name;
      if (!relative && generatedRoots.has(filename)) {
        insist(
          entry.isDirectory() && !entry.isSymbolicLink(),
          "Generated verification roots must be ordinary directories.",
        );
        return;
      }
      if (!inventory.has(filename)) {
        // Reject private state by name before descending or reading its content.
        publicSourcePath(filename);
      }
      insist(
        !entry.isSymbolicLink(),
        "Verification source must not contain links.",
      );
      if (entry.isDirectory()) {
        insist(
          [...inventory].some((name) => name.startsWith(`${filename}/`)),
          `Unadmitted verification source directory: ${filename}`,
        );
        return inspectSource(directory, filename, inventory, budget, signal);
      }
      insist(
        entry.isFile() && inventory.has(filename),
        `Unadmitted verification source file: ${filename}`,
      );
    }),
    signal,
  );
}

async function sourceSnapshot(directory, signal) {
  const policyBytes = await readSmall(directory, sourcePolicy, signal);
  const policy = JSON.parse(policyBytes);
  insist(
    Array.isArray(policy.allowedFiles) &&
      policy.allowedFiles.length > 0 &&
      policy.allowedFiles.length <= entryLimit &&
      new Set(policy.allowedFiles).size === policy.allowedFiles.length,
    "Verification requires the exact unique admitted source inventory.",
  );
  const sourceInputs = [
    ...new Set([
      sourcePolicy,
      ...policy.allowedFiles
        .filter((filename) => !examples.has(filename))
        .map(publicSourcePath),
    ]),
  ].sort(compareStrings);
  await inspectSource(
    directory,
    "",
    new Set([sourcePolicy, ...policy.allowedFiles]),
    { entries: 0 },
    signal,
  );
  insist(
    [".nvmrc", "package.json", "package-lock.json"].every((filename) =>
      sourceInputs.includes(filename),
    ),
    "Verification inventory must admit the pinned toolchain inputs.",
  );
  const files = await hashFiles(directory, sourceInputs, sourceLimit, signal);
  insist(
    policyBytes.equals(await readSmall(directory, sourcePolicy, signal)),
    "Source inventory changed while hashing.",
  );
  const fingerprint = createHash("sha256");
  for (const file of files)
    fingerprint
      .update(file.path)
      .update("\0")
      .update(String(file.bytes))
      .update("\0")
      .update(file.sha256)
      .update("\0");
  return { sourceFingerprint: fingerprint.digest("hex"), sourceInputs };
}

/** Check actual public input names, then fingerprint admitted bytes without private/generated reads. */
export async function fingerprintBuildSource(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  return sourceSnapshot(directory, cancellationSignal(options));
}

async function buildEnvironment(directory, inherited) {
  const { websiteEnvironment } = await syntheticRunnerInputs(
    directory,
    inherited,
  );
  return {
    ...Object.fromEntries(
      [
        "HOSTNAME",
        "PORT",
        "WEBSITE_URL",
        "API_BASE_URL",
        "WEBSITE_INDEXING_ENABLED",
        "NODE_ENV",
        "KERNEL_SYNTHETIC_ENV",
      ].map((key) => [key, websiteEnvironment[key]]),
    ),
    // CSP switches at request time; both reviewed modes use these same build bytes.
    WEBSITE_CSP_MODE: "report-only|enforce",
  };
}

async function toolchain(directory, signal) {
  const [pin, manifestBytes, lockBytes, installedBytes] = await completeWork(
    [
      readSmall(directory, ".nvmrc", signal),
      readSmall(directory, "package.json", signal),
      readSmall(directory, "package-lock.json", signal),
      readSmall(directory, "node_modules/next/package.json", signal),
    ],
    signal,
  );
  const manifest = JSON.parse(manifestBytes);
  const lock = JSON.parse(lockBytes);
  const installed = JSON.parse(installedBytes);
  const version = manifest.dependencies?.next;
  insist(
    `v${pin.toString("utf8").trim()}` === process.version,
    "Verification requires the pinned Node version.",
  );
  insist(
    manifest.name === "kernel-website" &&
      /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version ?? "") &&
      lock.lockfileVersion === 3 &&
      lock.packages?.[""]?.name === manifest.name &&
      lock.packages?.[""]?.dependencies?.next === version &&
      lock.packages?.["node_modules/next"]?.version === version &&
      installed.name === "next" &&
      installed.version === version,
    "Verification requires the exact manifest, lock and installed Next identity.",
  );
  return {
    node: process.version,
    abi: process.versions.modules,
    platform: process.platform,
    arch: process.arch,
    nextVersion: version,
  };
}

async function outputPaths(directory, relative, budget, signal) {
  signal?.throwIfAborted();
  await artifactDirectory(path.join(directory, relative));
  const entries = await readdir(path.join(directory, relative), {
    withFileTypes: true,
  });
  budget.entries += entries.length;
  insist(
    budget.entries <= entryLimit,
    "Verification output exceeds its entry budget.",
  );
  const groups = await completeWork(
    entries.map(async (entry) => {
      signal?.throwIfAborted();
      const filename = relativePath(`${relative}/${entry.name}`);
      insist(
        !entry.isSymbolicLink(),
        "Verification output must not contain links.",
      );
      if (caches.has(filename)) {
        insist(
          entry.isDirectory(),
          "Next cache paths must be ordinary directories.",
        );
        await artifactDirectory(path.join(directory, filename));
        return [];
      }
      if (entry.isDirectory())
        return outputPaths(directory, filename, budget, signal);
      insist(
        entry.isFile(),
        "Verification output must contain only ordinary files and directories.",
      );
      insist(
        !/(?:^|\/)\.env(?:\.|$)/i.test(filename) &&
          !/\.(?:pem|key|p12|pfx|sqlite3?|db)$/i.test(filename),
        "Verification output cannot contain private runtime files.",
      );
      return [filename];
    }),
    signal,
  );
  return groups.flat();
}

async function buildFiles(directory, signal) {
  const paths = (
    await outputPaths(directory, ".next", { entries: 0 }, signal)
  ).sort(compareStrings);
  const files = await hashFiles(directory, paths, outputLimit, signal);
  insist(
    [".next/BUILD_ID", ".next/standalone/server.js"].every((filename) =>
      files.some((file) => file.path === filename && file.bytes > 0),
    ) &&
      files.some(
        (file) => file.path.startsWith(".next/static/") && file.bytes > 0,
      ),
    "Verification requires BUILD_ID, standalone server and completed static assets.",
  );
  return files;
}

async function buildSnapshot(directory, environment, source, signal) {
  const before = await sourceSnapshot(directory, signal);
  if (source !== undefined)
    insist(
      isDeepStrictEqual(source, before),
      "Source changed after the verified build began.",
    );
  const [settings, runtime, files] = await completeWork(
    [
      buildEnvironment(directory, environment),
      toolchain(directory, signal),
      buildFiles(directory, signal),
    ],
    signal,
  );
  insist(
    isDeepStrictEqual(before, await sourceSnapshot(directory, signal)),
    "Source changed while verifying the build.",
  );
  return {
    schemaVersion: 1,
    ...before,
    environment: settings,
    toolchain: runtime,
    files,
  };
}

async function existingRecord(directory) {
  try {
    return await artifactFile(path.join(directory, recordPath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

async function writeRecord(directory, record, signal) {
  signal?.throwIfAborted();
  const content = JSON.stringify(record, null, 2) + "\n";
  insist(
    Buffer.byteLength(content) <= sourceLimit,
    "Verification record exceeds its byte budget.",
  );
  const coverage = await ensureArtifactDirectory(
    path.join(directory, "coverage"),
  );
  await existingRecord(directory);
  const stage = await mkdtemp(path.join(coverage, ".verification-build-"));
  const filename = path.join(stage, "record.json");
  let failure;
  try {
    signal?.throwIfAborted();
    {
      await using file = await open(filename, "wx", 0o600);
      await file.writeFile(content, { encoding: "utf8", signal });
    }
    signal?.throwIfAborted();
    await existingRecord(directory);
    signal?.throwIfAborted();
    await rename(filename, path.join(directory, recordPath));
    signal?.throwIfAborted();
  } catch (error) {
    failure = cancellationFailure(error, signal);
  }
  const failures = failure === undefined ? [] : [failure];
  try {
    await rm(filename, { force: true });
  } catch (error) {
    failures.push(error);
  }
  // Attempt the parent only after its file, including a failed file cleanup.
  try {
    await rmdir(stage);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Build record publication and cleanup failed",
      { cause: failures[0] },
    );
}

/** Remove only the owned ordinary record before a new build can fail. */
export async function invalidateVerificationBuild(root = repository) {
  const directory = await readyRunnerRoot(root);
  const filename = await existingRecord(directory);
  if (filename !== undefined) await rm(filename);
}

/**
 * Record a completed, budget-checked build. Cancellation drains owned I/O and
 * removes the owned proof, including an abort immediately after atomic publication.
 */
export async function recordVerificationBuild(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = cancellationSignal(options);
  try {
    const record = await buildSnapshot(
      directory,
      options.environment ?? process.env,
      options.source,
      signal,
    );
    await writeRecord(directory, record, signal);
    signal?.throwIfAborted();
    return record;
  } catch (error) {
    if (!signal?.aborted) throw error;
    await completeWork(
      [
        Promise.reject(error),
        (async () => {
          const filename = await existingRecord(directory);
          if (filename !== undefined) await rm(filename);
        })(),
      ],
      signal,
    );
  }
}

/** Verify source, semantic inputs, toolchain and all non-cache output without running code. */
export async function verifyVerificationBuild(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const record = JSON.parse(await readSmall(directory, recordPath));
  const current = await buildSnapshot(
    directory,
    options.environment ?? process.env,
  );
  insist(
    isDeepStrictEqual(record, current),
    "Verification build does not match the current source, environment, toolchain or output bytes.",
  );
  return record;
}
