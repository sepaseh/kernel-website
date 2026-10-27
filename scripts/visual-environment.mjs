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

async function visualDirectory(directory) {
  if (typeof directory !== "string" || !directory.trim())
    throw new Error("Visual output directory must be explicit.");
  const destination = path.resolve(directory);
  let cursor = path.parse(destination).root;
  for (const part of path.relative(cursor, destination).split(path.sep)) {
    cursor = path.join(cursor, part);
    let entry;
    try {
      entry = await lstat(cursor);
    } catch (error_) {
      if (error_.code !== "ENOENT") throw error_;
      try {
        await mkdir(cursor);
      } catch (error_) {
        if (error_.code !== "EEXIST") throw error_;
      }
      entry = await lstat(cursor);
    }
    if (entry.isSymbolicLink() || !entry.isDirectory())
      throw new Error("Visual output must stay in an unlinked directory.");
  }
  return destination;
}

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

export async function acquireVisualLock(resultsDirectory) {
  const directory = await visualDirectory(resultsDirectory);
  const filename = path.join(directory, ".visual-run.lock");
  let handle;
  try {
    handle = await open(filename, "wx");
  } catch (error_) {
    if (error_.code === "EEXIST")
      throw new Error(
        "Another visual run owns the build outputs. Do not overlap visual runs.",
        { cause: error_ },
      );
    throw error_;
  }
  const identity = await handle.stat({ bigint: true });
  try {
    await handle.writeFile(`${process.pid}\n`);
  } catch (error_) {
    await handle.close();
    await removeOwnedLock(filename, identity);
    throw error_;
  }
  let release;
  return () =>
    (release ??= (async () => {
      await handle.close();
      await removeOwnedLock(filename, identity);
    })());
}

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

export function visualEnvironment(inherited = process.env) {
  return {
    PATH: typeof inherited?.PATH === "string" ? inherited.PATH : "",
    ...Object.fromEntries(
      ["SystemRoot", "TEMP", "TMP", "KERNEL_API_DIRECTORY"]
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

export async function assertVisualPortsAvailable(ports = [3100, 3101]) {
  if (
    !Array.isArray(ports) ||
    ports.some((port) => !Number.isInteger(port) || port < 0 || port > 65535)
  )
    throw new Error("Visual fixture ports must be integer TCP ports.");
  for (const port of ports) {
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
}
