import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Validate one path component before descent; optional components may be absent,
 * while links, nondirectories and other filesystem failures remain errors.
 * @returns {boolean} False only for an optional missing path, true for a verified
 * physical directory. This guard creates, reads and removes no file contents.
 */
function assertUnlinkedDirectory(directory, optional = false) {
  let info;
  try {
    info = lstatSync(directory);
  } catch (error) {
    if (optional && error.code === "ENOENT") return false;
    throw error;
  }
  if (info.isSymbolicLink())
    throw new Error(
      "Performance tools require an unlinked owned website directory.",
    );
  if (!info.isDirectory())
    throw new Error("Performance website path must be a directory.");
  return true;
}

/**
 * Check physical directory ancestry before inspecting root and optional standalone
 * entry names. Reject runtime dotenv presence without opening or changing files,
 * allowing only the exact .env.example name in either inspected directory.
 * @param {string} websiteDirectory Website path normalized before ancestry checks.
 * @returns {void} Returns only when inspected directories contain no runtime dotenv.
 * This filesystem guard neither checks readiness nor authorizes tool execution.
 */
export function assertCleanWebsiteEnvironment(websiteDirectory) {
  const directory = path.resolve(websiteDirectory);
  const ancestors = [];
  let cursor = directory;
  while (true) {
    ancestors.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  for (const ancestor of ancestors.toReversed())
    assertUnlinkedDirectory(ancestor);

  const standalone = path.join(directory, ".next/standalone");
  const directories = [directory];
  if (
    assertUnlinkedDirectory(path.join(directory, ".next"), true) &&
    assertUnlinkedDirectory(standalone, true)
  )
    directories.push(standalone);
  for (const candidate of directories)
    if (
      readdirSync(candidate).some(
        (name) => /^\.env(?:\.|$)/i.test(name) && name !== ".env.example",
      )
    )
      throw new Error(
        "Isolated performance tools require a clean website checkout without runtime dotenv files. No file was read or changed; use a clean checkout with installed dependencies.",
      );
}

/**
 * Require an explicit HTTP IPv4 loopback API port and build fixed synthetic
 * production settings, inheriting only process-location essentials for children.
 * @param {string} apiOrigin Isolated API origin without credentials, query or path.
 * @param {object} inherited Source of PATH and optional Windows/temp runtime values.
 * @returns {object} A fresh child environment with disabled indexing and telemetry;
 * private inherited keys are omitted and the supplied object is not modified.
 */
export function websitePerformanceEnvironment(
  apiOrigin,
  inherited = process.env,
) {
  let url;
  try {
    url = new URL(apiOrigin);
  } catch {
    throw new Error(
      "Performance API must be an explicit isolated IPv4 loopback origin with a nonzero port.",
    );
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    Number(url.port) === 0 ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "Performance API must be an explicit isolated IPv4 loopback origin with a nonzero port.",
    );

  return {
    API_BASE_URL: url.origin,
    CI: "1",
    HOSTNAME: "127.0.0.1",
    KERNEL_SYNTHETIC_ENV: "1",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    WEBSITE_INDEXING_ENABLED: "false",
    WEBSITE_URL: "https://kernel-performance.test",
    PATH: typeof inherited?.PATH === "string" ? inherited.PATH : "",
    ...Object.fromEntries(
      ["SystemRoot", "TEMP", "TMP"]
        .filter((key) => typeof inherited?.[key] === "string" && inherited[key])
        .map((key) => [key, inherited[key]]),
    ),
  };
}
