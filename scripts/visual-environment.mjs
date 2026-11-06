import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Verify or create each output parent before descending into it, rejecting linked
 * or non-directory entries even when another creator wins the mkdir race.
 */
async function createVisualDirectory(cursor, parts, index = 0) {
  if (index === parts.length) return cursor;
  const next = path.join(cursor, parts[index]);
  let entry;
  try {
    entry = await lstat(next);
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
    try {
      await mkdir(next);
    } catch (error_) {
      if (error_.code !== "EEXIST") throw error_;
    }
    entry = await lstat(next);
  }
  if (entry.isSymbolicLink() || !entry.isDirectory())
    throw new Error("Visual output must stay in an unlinked directory.");
  // Verify or create each parent before inspecting or creating its child.
  return createVisualDirectory(next, parts, index + 1);
}

/** Resolve an explicit output path through the checked, unlinked directory chain. */
async function visualDirectory(directory) {
  if (typeof directory !== "string" || !directory.trim())
    throw new Error("Visual output directory must be explicit.");
  const destination = path.resolve(directory);
  const root = path.parse(destination).root;
  return createVisualDirectory(
    root,
    path.relative(root, destination).split(path.sep),
  );
}

/**
 * Atomically replace metadata with pending review fields through an exclusive
 * temporary file. Only that temporary file is cleaned on failure, and write and
 * cleanup errors remain visible without treating capture as human review.
 */
export async function markVisualBaselinePending(metadataPath, metadata) {
  if (!record(metadata)) throw new Error("Visual metadata must be an object.");
  const content = `${JSON.stringify({ ...metadata, review: { status: "pending", reviewer: null, reviewedAt: null } }, null, 2)}\n`;
  const directory = await visualDirectory(path.dirname(metadataPath));
  const filename = path.join(directory, path.basename(metadataPath));
  try {
    const entry = await lstat(filename);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("Visual metadata must be an unlinked regular file.");
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
  }
  const temporary = path.join(
    directory,
    `.${path.basename(filename)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, content, { flag: "wx" });
    await rename(temporary, filename);
  } catch (error_) {
    const originalError = error_;
    try {
      await unlink(temporary);
    } catch (error_) {
      if (error_.code !== "ENOENT")
        throw new AggregateError(
          [originalError, error_],
          "Visual metadata write and owned cleanup failed.",
          { cause: error_ },
        );
    }
    throw originalError;
  }
}

/** Remove a lock only when its device/inode still matches the acquired descriptor. */
async function removeOwnedLock(filename, identity) {
  let entry;
  try {
    entry = await lstat(filename, { bigint: true });
  } catch (error_) {
    if (error_.code === "ENOENT") return;
    throw error_;
  }
  if (
    entry.isSymbolicLink() ||
    entry.ino !== identity.ino ||
    entry.dev !== identity.dev
  )
    throw new Error(
      "Visual lock ownership changed; the replacement was not removed.",
    );
  await unlink(filename);
}

/**
 * Exclusively acquire visual output ownership and return an idempotent release
 * callback. Release may close the descriptor while retaining exclusion for an
 * unclosed child; failed initial identity checks also preserve the unknown lock.
 */
export async function acquireVisualLock(resultsDirectory) {
  const directory = await visualDirectory(resultsDirectory);
  const filename = path.join(directory, ".visual-run.lock");
  let handle;
  try {
    handle = await open(filename, "wx");
  } catch (error_) {
    if (error_.code === "EEXIST")
      throw new Error(
        `Another visual run owns the build outputs (${filename}). Do not overlap visual runs.`,
        { cause: error_ },
      );
    throw error_;
  }
  let identity;
  try {
    identity = await handle.stat({ bigint: true });
    await handle.writeFile(`${process.pid}\n`);
  } catch (error_) {
    try {
      await handle.close();
      // Without descriptor identity, retaining exclusion is safer than removing
      // a pathname that could now belong to a replacement owner.
      if (identity) await removeOwnedLock(filename, identity);
    } catch (cleanupError) {
      throw new AggregateError(
        [error_, cleanupError],
        "Visual lock initialization and owned cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw error_;
  }
  let release;
  return ({ retain = false } = {}) =>
    (release ??= (async () => {
      await handle.close();
      if (!retain) await removeOwnedLock(filename, identity);
    })());
}

/** Reject implicit mode flags, unsupported baseline platforms and every CI update. */
export function assertVisualMode(options) {
  if (
    !record(options) ||
    typeof options.update !== "boolean" ||
    typeof options.ci !== "boolean"
  )
    throw new Error("Visual mode requires explicit update and CI booleans.");
  if (options.update && options.ci)
    throw new Error("Visual baseline updates are forbidden in CI.");
  if (!["win32", "linux"].includes(options.platform))
    throw new Error(
      `No visual baseline workflow is defined for ${options.platform}.`,
    );
}

/**
 * Require matching platform/SDK identity and recorded review fields; optionally
 * check the probed browser version. Metadata validity alone cannot prove review.
 */
export function assertReviewedVisualBaseline(metadata, expected) {
  if (
    !record(expected) ||
    !["win32", "linux"].includes(expected.platform) ||
    typeof expected.playwright !== "string" ||
    !expected.playwright.trim()
  )
    throw new Error("Expected visual platform/version must be explicit.");
  if (
    !record(metadata) ||
    metadata.platform !== expected.platform ||
    metadata.playwright !== expected.playwright ||
    !record(metadata.review) ||
    metadata.review.status !== "reviewed" ||
    typeof metadata.review.reviewer !== "string" ||
    !metadata.review.reviewer.trim() ||
    typeof metadata.review.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(metadata.review.reviewedAt))
  )
    throw new Error(
      "Visual baseline platform/version/review metadata mismatch.",
    );
  if (
    expected.browserVersion !== undefined &&
    (typeof expected.browserVersion !== "string" ||
      !expected.browserVersion.trim() ||
      metadata.browserVersion !== expected.browserVersion)
  )
    throw new Error("Installed Chromium does not match reviewed baselines.");
}

/**
 * Build an allowlisted synthetic parent environment with telemetry disabled and
 * rebuilds enabled, leaving private inherited values out of browser children.
 */
export function visualEnvironment(inherited = process.env) {
  return {
    PATH: typeof inherited?.PATH === "string" ? inherited.PATH : "",
    ...Object.fromEntries(
      ["SystemRoot", "TEMP", "TMP"]
        .filter((key) => typeof inherited?.[key] === "string" && inherited[key])
        .map((key) => [key, inherited[key]]),
    ),
    CI: inherited?.CI ? "1" : "",
    KERNEL_VISUAL_RUNNER: "1",
    KERNEL_SYNTHETIC_ENV: "1",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    STORYBOOK_DISABLE_TELEMETRY: "1",
    WEBSITE_SKIP_BUILD: "0",
  };
}

/** Bind IPv4 loopback to verify availability, closing only this probe's listener. */
async function probeVisualPort(port) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", (error_) =>
        reject(
          new Error(
            `Visual fixture port ${port} is already in use or unavailable.`,
            { cause: error_ },
          ),
        ),
      );
      server.listen(port, "127.0.0.1", resolve);
    });
  } finally {
    if (server.listening)
      await new Promise((resolve, reject) =>
        server.close((error_) => (error_ ? reject(error_) : resolve())),
      );
  }
}

/**
 * Validate and deduplicate requested TCP ports, then wait for every independent
 * probe's cleanup before surfacing a failure so no owned listener outlives preflight.
 */
export async function assertVisualPortsAvailable(ports = [3100, 3101]) {
  if (
    !Array.isArray(ports) ||
    ports.some((port) => !Number.isInteger(port) || port < 0 || port > 65535)
  )
    throw new Error("Visual fixture ports must be integer TCP ports.");
  // Distinct ports are independent, but every owned listener must finish its
  // cleanup before a failure is reported to the caller.
  const results = await Promise.allSettled(
    [...new Set(ports)].map(probeVisualPort),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}
