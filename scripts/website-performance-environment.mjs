import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

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
