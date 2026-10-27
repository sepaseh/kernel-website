import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

export function assertCleanWebsiteEnvironment(websiteDirectory) {
  const directory = path.resolve(websiteDirectory);
  let cursor = directory;
  while (true) {
    if (lstatSync(cursor).isSymbolicLink())
      throw new Error(
        "Performance tools require an unlinked owned website directory.",
      );
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (!lstatSync(directory).isDirectory())
    throw new Error("Performance website path must be a directory.");
  if (
    readdirSync(directory).some(
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
