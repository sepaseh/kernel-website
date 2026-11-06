import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { requireApplicationReady } from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const assetList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
/** Keep manifest and report ordering independent of the host's locale. */
const compareStrings = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

/**
 * Parse the supported generated assignment as JSON, never executable code, and
 * reject malformed client, JavaScript or CSS graph collections before use.
 */
export function parseClientManifest(text) {
  // Generated assignments contain JSON. No build output is evaluated as code.
  const assignment =
    typeof text === "string"
      ? /globalThis\.__RSC_MANIFEST\["(?:[^"\\\r\n]|\\.)*"\]\s*=\s*(?=\{)/.exec(
          text,
        )
      : null;
  if (!assignment) throw new Error("Unsupported Next client manifest format.");
  const manifest = JSON.parse(
    text
      .slice(assignment.index + assignment[0].length)
      .trim()
      .replace(/;$/, ""),
  );
  if (
    !record(manifest) ||
    !record(manifest.clientModules) ||
    !record(manifest.entryCSSFiles)
  )
    throw new Error("Next client manifest has no client/CSS graph.");
  if (
    manifest.entryJSFiles !== undefined &&
    (!record(manifest.entryJSFiles) ||
      Object.values(manifest.entryJSFiles).some((items) => !assetList(items)))
  )
    throw new Error("Invalid Next client entry JavaScript list.");
  for (const item of Object.values(manifest.clientModules))
    if (!record(item) || !assetList(item.chunks))
      throw new Error("Invalid Next client chunk list.");
  for (const items of Object.values(manifest.entryCSSFiles))
    if (
      !Array.isArray(items) ||
      items.some(
        (item) =>
          typeof item !== "string" &&
          (!record(item) || typeof item.path !== "string"),
      )
    )
      throw new Error("Invalid Next client CSS list.");
  return manifest;
}

/**
 * Normalize emitted browser asset prefixes and bracket escapes while rejecting
 * traversal, empty segments and paths outside the static JavaScript/CSS tree.
 */
export function clientAssetPath(value) {
  const normalized =
    typeof value === "string"
      ? value
          .replace(/^\/_next\//, "")
          .replace(/%5b/gi, "[")
          .replace(/%5d/gi, "]")
      : "";
  if (
    !/^static\/[a-zA-Z0-9_./~[\]-]+\.(?:js|css)$/.test(normalized) ||
    normalized.split("/").some((part) => !part || part === ".." || part === ".")
  )
    throw new Error(`Not a browser JS/CSS asset: ${value}`);
  return normalized;
}

/**
 * Decode either filename-only chunks or webpack's alternating ID/filename
 * entries, rejecting incomplete or mixed representations before measurement.
 */
function clientChunkAssets(chunks) {
  const filename = (value) =>
    value.startsWith("static/") || value.startsWith("/_next/static/");
  if (chunks.every(filename)) return chunks;
  if (
    chunks.length % 2 !== 0 ||
    chunks.some((value, index) =>
      index % 2 === 0 ? !value || filename(value) : !filename(value),
    )
  )
    throw new Error("Invalid Next client chunk ID/filename pairs.");

  return chunks.filter((_, index) => index % 2 === 1);
}

/** Resolve an existing build directory only if it and its ancestors are unlinked. */
async function buildRoot(directory) {
  const root = path.resolve(directory);
  for (let cursor = root; ; cursor = path.dirname(cursor)) {
    const entry = await lstat(cursor);
    if (entry.isSymbolicLink())
      throw new Error("Build inputs must not follow symbolic links.");
    if (cursor === root && !entry.isDirectory())
      throw new Error("Build input must be a directory.");
    if (path.dirname(cursor) === cursor) return root;
  }
}

/**
 * Read a validated relative regular file beneath the inspected build root;
 * absolute paths, traversal and linked ancestors are rejected before the read.
 */
async function buildFile(root, relative) {
  if (
    typeof relative !== "string" ||
    path.isAbsolute(relative) ||
    /[\\:\0\r\n]/.test(relative) ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Unsafe build file path.");
  const { filename, entry } = await buildEntry(root, relative);
  if (!entry.isFile()) throw new Error("Build input must be a regular file.");
  return readFile(filename);
}

/** Inspect ancestors before descendants so a build entry cannot cross a link. */
async function buildEntry(root, relative) {
  const parent = path.posix.dirname(relative);
  if (parent !== ".") {
    const ancestor = await buildEntry(root, parent);
    if (!ancestor.entry.isDirectory())
      throw new Error("Build ancestor must be a directory.");
  }
  const filename = path.join(root, relative);
  const entry = await lstat(filename);
  if (entry.isSymbolicLink())
    throw new Error("Build inputs must not follow symbolic links.");
  return { filename, entry };
}

/**
 * Enumerate emitted JavaScript/CSS beneath an inspected directory without
 * following links or counting unrelated file types as browser assets.
 */
async function filesUnder(root, relative) {
  const { filename: directory, entry } = await buildEntry(root, relative);
  if (!entry.isDirectory())
    throw new Error("Browser assets must be in a directory.");
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((item) => item.isSymbolicLink()))
    throw new Error("Build inputs must not follow symbolic links.");
  const groups = await Promise.all(
    entries.map((item) => {
      const filename = `${relative}/${item.name}`;
      if (item.isDirectory()) return filesUnder(root, filename);
      return item.isFile() && /\.(?:js|css)$/.test(item.name) ? [filename] : [];
    }),
  );
  return groups.flat();
}

/** Reject unsafe internal page paths and malformed public route-map values. */
const pageEntry = (entry, route) => {
  if (
    !entry.startsWith("/") ||
    entry
      .split("/")
      .slice(1)
      .some((part) => !part || part === "." || part === "..") ||
    /[\\:\0\r\n]/.test(entry)
  )
    throw new Error("Unsafe page entry in route manifest.");
  if (
    typeof route !== "string" ||
    !route.startsWith("/") ||
    route.startsWith("//") ||
    /[\\?#\0\r\n]/.test(route) ||
    route.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error("Invalid page route in route manifest.");
};

/**
 * Separate a page's public route from its parallel-slot signature. Route groups
 * do not affect either identity, and the implicit children slot is canonicalized.
 */
function pageIdentity(entry) {
  const segments = entry
    .split("/")
    .slice(1, -1)
    .filter((part) => !(part.startsWith("(") && part.endsWith(")")));
  return {
    signature: segments.filter((part) => part !== "@children").join("/"),
    route: `/${segments.filter((part) => !part.startsWith("@")).join("/")}`,
  };
}

/**
 * Group validated page entries by route, retaining distinct parallel slots while
 * rejecting aliases that would silently hide a malformed duplicate page graph.
 */
function pageGraphs(routeMap) {
  const pages = Object.entries(routeMap)
    .sort((left, right) => compareStrings(String(left), String(right)))
    .filter(([entry]) => entry.endsWith("/page"));
  if (!pages.length) throw new Error("No website page client graphs found.");

  const routeEntries = new Map();
  for (const [entry, route] of pages) {
    pageEntry(entry, route);
    const entries = routeEntries.get(route) ?? [];
    const identity = pageIdentity(entry);
    if (
      entries.length &&
      (identity.route !== route ||
        entries.some((previous) => {
          const other = pageIdentity(previous);
          return (
            other.route !== route || other.signature === identity.signature
          );
        }))
    )
      throw new Error("Duplicate page route in route manifest.");

    entries.push(entry);
    routeEntries.set(route, entries);
  }
  return routeEntries;
}

/** Collect one page's client chunks, entry scripts and CSS from its JSON graph. */
async function pageAssets(root, entry) {
  const filename = `server/app/${entry.slice(1)}_client-reference-manifest.js`;
  const manifest = parseClientManifest(
    (await buildFile(root, filename)).toString("utf8"),
  );
  const chunks = Object.values(manifest.clientModules).flatMap((item) =>
    clientChunkAssets(item.chunks),
  );
  const entryJavaScript = Object.values(manifest.entryJSFiles ?? {}).flat();
  const css = Object.values(manifest.entryCSSFiles).flatMap((items) =>
    items.map((item) => (typeof item === "string" ? item : item.path)),
  );
  return [...chunks, ...entryJavaScript, ...css];
}

/**
 * Count each normalized reachable asset once, rejecting missing files instead of
 * treating an incomplete client graph as a smaller successful measurement.
 */
function summarizeAssets(files, assets) {
  const paths = [...new Set(files.map(clientAssetPath))].sort(compareStrings);
  let javaScriptBytes = 0;
  let javaScriptGzipBytes = 0;
  let cssBytes = 0;
  for (const file of paths) {
    const asset = assets.get(file);
    if (!asset) throw new Error(`Missing browser asset: ${file}`);
    if (file.endsWith(".js")) {
      javaScriptBytes += asset.bytes;
      javaScriptGzipBytes += asset.gzipBytes;
    } else cssBytes += asset.bytes;
  }
  return { javaScriptBytes, javaScriptGzipBytes, cssBytes, files: paths };
}

/**
 * Measure unique emitted browser assets and each route's reachable client graph
 * from an existing build. The report includes gzip bytes, not actual network
 * transfer or browser acceptance; the executable caller separately gates readiness.
 */
export async function measureWebsiteBundle(buildDirectory) {
  const root = await buildRoot(buildDirectory);
  await buildFile(root, "BUILD_ID");
  const build = JSON.parse(
    (await buildFile(root, "build-manifest.json")).toString("utf8"),
  );
  const routeMap = JSON.parse(
    (await buildFile(root, "app-path-routes-manifest.json")).toString("utf8"),
  );
  if (
    !record(build) ||
    !assetList(build.rootMainFiles) ||
    !assetList(build.polyfillFiles) ||
    !record(routeMap)
  )
    throw new Error("Invalid browser build or route manifest.");
  const assets = new Map(
    await Promise.all(
      (await filesUnder(root, "static")).map(async (file) => {
        const buffer = await buildFile(root, file);
        return [
          file,
          {
            bytes: buffer.length,
            gzipBytes: gzipSync(buffer, { level: 9 }).length,
          },
        ];
      }),
    ),
  );
  const routes = Object.fromEntries(
    await Promise.all(
      [...pageGraphs(routeMap)].map(async ([route, entries]) => [
        route,
        summarizeAssets(
          [
            ...build.rootMainFiles,
            ...build.polyfillFiles,
            ...(
              await Promise.all(entries.map((entry) => pageAssets(root, entry)))
            ).flat(),
          ],
          assets,
        ),
      ]),
    ),
  );
  return {
    version: 1,
    definition:
      "Unique emitted browser JS/CSS and per-page reachable client graph (including shared runtime, polyfills and error boundaries); not initial transfer size.",
    ...summarizeAssets([...assets.keys()], assets),
    largestJavaScriptBytes: Math.max(
      0,
      ...[...assets]
        .filter(([file]) => file.endsWith(".js"))
        .map(([, asset]) => asset.bytes),
    ),
    routes,
  };
}

/**
 * Validate nonnegative integer measurements and budget limits, returning every
 * exceeded global or route limit while throwing for malformed report inputs.
 */
export function evaluateWebsiteBudget(report, budget) {
  if (!record(budget) || budget.version !== 1)
    throw new Error("Unsupported website budget version.");
  if (
    !record(report) ||
    !record(report.routes) ||
    !Object.keys(report.routes).length
  )
    throw new Error("Invalid website bundle report.");
  const failures = [];
  /** Validate a measurement/limit pair before adding its human-readable failure. */
  const check = (label, value, key) => {
    if (
      !Number.isSafeInteger(budget[key]) ||
      budget[key] < 0 ||
      !Number.isSafeInteger(value) ||
      value < 0
    )
      throw new Error(`Invalid website budget measurement: ${key}`);
    if (value > budget[key])
      failures.push(`${label}: ${value} bytes exceeds ${budget[key]}`);
  };
  check(
    "All browser JavaScript",
    report.javaScriptBytes,
    "totalJavaScriptBytes",
  );
  check(
    "Largest browser JavaScript chunk",
    report.largestJavaScriptBytes,
    "largestJavaScriptBytes",
  );
  check("All browser CSS", report.cssBytes, "totalCssBytes");
  for (const [route, value] of Object.entries(report.routes)) {
    if (!record(value)) throw new Error("Invalid website route measurements.");
    check(
      `${route} client graph JavaScript`,
      value.javaScriptBytes,
      "routeJavaScriptBytes",
    );
    check(
      `${route} client graph JavaScript gzip`,
      value.javaScriptGzipBytes,
      "routeJavaScriptGzipBytes",
    );
    check(`${route} client graph CSS`, value.cssBytes, "routeCssBytes");
  }
  return failures;
}

/** Create or verify report directories one level at a time without following links. */
async function reportFolder(parent, components) {
  if (!components.length) return parent;
  const [component, ...remaining] = components;
  const directory = path.join(parent, component);
  try {
    const entry = await lstat(directory);
    if (entry.isSymbolicLink() || !entry.isDirectory())
      throw new Error(
        "Bundle report directory must not follow symbolic links.",
      );
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
    await mkdir(directory);
  }
  return reportFolder(directory, remaining);
}

/** Return the owned report path only after its parents and any existing file pass checks. */
async function reportDirectory() {
  const directory = await reportFolder(repository, [
    ".lighthouseci",
    "website",
  ]);
  const filename = path.join(directory, "bundle.json");
  try {
    const entry = await lstat(filename);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("Bundle report must be an unlinked regular file.");
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
  }
  return filename;
}

if (typeof import.meta.main !== "boolean") {
  process.stderr.write(
    "Bundle inspection requires the repository's Node.js 24 runtime.\n",
  );
  process.exitCode = 1;
} else if (import.meta.main) {
  try {
    await requireApplicationReady(repository);
    const report = await measureWebsiteBundle(path.join(repository, ".next"));
    const budget = JSON.parse(
      (await buildFile(repository, "performance-budget.json")).toString("utf8"),
    );
    await writeFile(
      await reportDirectory(),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.table(
      Object.entries(report.routes).map(([route, values]) => ({
        route,
        JS: values.javaScriptBytes,
        gzipJS: values.javaScriptGzipBytes,
        CSS: values.cssBytes,
      })),
    );
    console.log(
      `Website browser JS ${report.javaScriptBytes} bytes; largest chunk ${report.largestJavaScriptBytes}; CSS ${report.cssBytes}.`,
    );
    const failures = evaluateWebsiteBudget(report, budget);
    if (failures.length) throw new Error(failures.join("\n"));
    console.log("Website client bundle budget passed.");
  } catch (error_) {
    console.error(error_.message);
    process.exitCode = 1;
  }
}
