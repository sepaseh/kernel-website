import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  clientAssetPath,
  evaluateWebsiteBudget,
  measureWebsiteBundle,
  parseClientManifest,
} from "./check-bundle-website.mjs";
import {
  assertCleanWebsiteEnvironment,
  websitePerformanceEnvironment,
} from "./website-performance-environment.mjs";

const budget = {
  version: 1,
  totalJavaScriptBytes: 150,
  largestJavaScriptBytes: 100,
  totalCssBytes: 20,
  routeJavaScriptBytes: 150,
  routeJavaScriptGzipBytes: 50,
  routeCssBytes: 20,
};
const report = () => ({
  javaScriptBytes: 150,
  largestJavaScriptBytes: 100,
  cssBytes: 20,
  routes: {
    "/": { javaScriptBytes: 150, javaScriptGzipBytes: 50, cssBytes: 20 },
  },
});
const clientGraph = (
  chunks = ["/_next/static/chunks/shared.js", "/_next/static/chunks/page.js"],
) => ({
  clientModules: { a: { chunks }, b: { chunks: ["static/chunks/page.js"] } },
  entryCSSFiles: {
    layout: [{ path: "static/chunks/style.css" }],
    legacy: ["static/chunks/style.css"],
  },
});
const assignment = (graph) =>
  `globalThis.__RSC_MANIFEST = {};\nglobalThis.__RSC_MANIFEST["/page"] = ${JSON.stringify(graph)};`;
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "website-bundle-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const build = path.join(root, ".next");
  for (const directory of ["static/chunks", "server/app/nested"])
    await mkdir(path.join(build, directory), { recursive: true });
  const write = (name, value) =>
    writeFile(
      path.join(build, name),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  await Promise.all([
    write("BUILD_ID", "synthetic"),
    write("static/chunks/shared.js", "x".repeat(100)),
    write("static/chunks/page.js", "y".repeat(50)),
    write("static/chunks/style.css", "z".repeat(20)),
    write("static/chunks/page.js.map", "s".repeat(10000)),
    write("server/large.js", "s".repeat(100000)),
    write("build-manifest.json", {
      rootMainFiles: ["static/chunks/shared.js"],
      polyfillFiles: [],
    }),
    write("app-path-routes-manifest.json", {
      "/page": "/",
      "/nested/page": "/nested",
      "/api/route": "/api",
    }),
    write(
      "server/app/page_client-reference-manifest.js",
      assignment(clientGraph()),
    ),
    write(
      "server/app/nested/page_client-reference-manifest.js",
      assignment(clientGraph()),
    ),
  ]);
  return { root, build, write };
}

test("only emitted browser assets count, shared graph chunks deduplicate and future pages are measured", async (t) => {
  const { build } = await fixture(t);
  const result = await measureWebsiteBundle(build);
  assert.equal(result.javaScriptBytes, 150);
  assert.equal(result.largestJavaScriptBytes, 100);
  assert.equal(result.cssBytes, 20);
  assert.deepEqual(Object.keys(result.routes).sort(), ["/", "/nested"]);
  assert.equal(result.routes["/nested"].javaScriptBytes, 150);
  assert.equal(result.routes["/"].files.length, 3);
  assert.ok(result.routes["/"].javaScriptGzipBytes > 0);
});

test("bundle budgets pass boundaries and report each exceeded resource", () => {
  assert.deepEqual(evaluateWebsiteBudget(report(), budget), []);
  const larger = report();
  larger.javaScriptBytes++;
  larger.largestJavaScriptBytes++;
  larger.cssBytes++;
  larger.routes["/"] = {
    javaScriptBytes: 151,
    javaScriptGzipBytes: 51,
    cssBytes: 21,
  };
  assert.equal(evaluateWebsiteBudget(larger, budget).length, 6);
  for (const invalid of [{ version: 2 }, null])
    assert.throws(
      () => evaluateWebsiteBudget(report(), invalid),
      /Unsupported website budget/,
    );
  for (const invalid of [undefined, -1, 0.5, Infinity])
    assert.throws(
      () =>
        evaluateWebsiteBudget(report(), {
          ...budget,
          totalJavaScriptBytes: invalid,
        }),
      /Invalid website budget/,
    );
  for (const invalid of [
    null,
    { ...report(), routes: {} },
    { ...report(), routes: { "/": null } },
  ])
    assert.throws(
      () => evaluateWebsiteBudget(invalid, budget),
      /Invalid website/,
    );
  const negative = report();
  negative.javaScriptBytes = -1;
  assert.throws(
    () => evaluateWebsiteBudget(negative, budget),
    /Invalid website budget/,
  );
});

test("client graphs are parsed as data and malformed shapes cannot become executable input", () => {
  for (const invalid of [
    undefined,
    "globalThis.runSomething()",
    `${assignment(clientGraph())}\nprocess.exit(0);`,
  ])
    assert.throws(() => parseClientManifest(invalid));
  for (const graph of [
    {},
    { clientModules: [], entryCSSFiles: {} },
    { clientModules: { a: { chunks: "not-an-array" } }, entryCSSFiles: {} },
    { clientModules: {}, entryCSSFiles: { a: "not-an-array" } },
    { clientModules: {}, entryCSSFiles: { a: [{}] } },
  ])
    assert.throws(
      () => parseClientManifest(assignment(graph)),
      /graph|chunk|CSS/,
    );
  assert.deepEqual(
    parseClientManifest(assignment(clientGraph())),
    clientGraph(),
  );
  for (const invalid of [
    undefined,
    "server/large.js",
    "static/../private.js",
    "static/./x.js",
    "static//a.js",
    "https://external.test/a.js",
    "static/chunks/a.js.map",
    "static\\a.js",
  ])
    assert.throws(() => clientAssetPath(invalid), /Not a browser/);
  assert.equal(
    clientAssetPath("/_next/static/chunks/a.js"),
    "static/chunks/a.js",
  );
});

test("build manifests reject route traversal, duplicate routes and missing assets", async (t) => {
  const { build, write } = await fixture(t);
  for (const routes of [
    { "/../outside/page": "/" },
    { "/page": "https://external.test" },
    { "/page": "/", "/nested/page": "/" },
    {},
  ]) {
    await write("app-path-routes-manifest.json", routes);
    await assert.rejects(
      measureWebsiteBundle(build),
      /Unsafe page|Invalid page|Duplicate page|No website page/,
    );
  }
  await write("app-path-routes-manifest.json", { "/page": "/" });
  await write(
    "server/app/page_client-reference-manifest.js",
    assignment(clientGraph(["static/chunks/missing.js"])),
  );
  await assert.rejects(measureWebsiteBundle(build), /Missing browser asset/);
  await write("build-manifest.json", {
    rootMainFiles: "invalid",
    polyfillFiles: [],
  });
  await assert.rejects(measureWebsiteBundle(build), /Invalid browser build/);
});

test("linked build roots, asset directories and manifest ancestors are rejected before input reads", async (t) => {
  const { root, build } = await fixture(t);
  const alias = path.join(root, "alias");
  await symlink(build, alias, "junction");
  await assert.rejects(measureWebsiteBundle(alias), /symbolic links/);
  const actual = path.join(build, "actual-chunks");
  await rename(path.join(build, "static/chunks"), actual);
  await symlink(actual, path.join(build, "static/chunks"), "junction");
  await assert.rejects(measureWebsiteBundle(build), /symbolic links/);
  await rm(path.join(build, "static/chunks"));
  await rename(actual, path.join(build, "static/chunks"));
  const server = path.join(build, "actual-server");
  await rename(path.join(build, "server"), server);
  await symlink(server, path.join(build, "server"), "junction");
  await assert.rejects(measureWebsiteBundle(build), /symbolic links/);
});

test("a CSS-only graph reports zero JavaScript rather than a nonfinite largest chunk", async (t) => {
  const { build, write } = await fixture(t);
  await rm(path.join(build, "static/chunks/shared.js"));
  await rm(path.join(build, "static/chunks/page.js"));
  await write("build-manifest.json", { rootMainFiles: [], polyfillFiles: [] });
  for (const name of ["page", "nested/page"])
    await write(
      `server/app/${name}_client-reference-manifest.js`,
      assignment({
        clientModules: {},
        entryCSSFiles: { layout: ["static/chunks/style.css"] },
      }),
    );
  const result = await measureWebsiteBundle(build);
  assert.equal(result.largestJavaScriptBytes, 0);
  assert.equal(result.javaScriptBytes, 0);
});

test("bundle CLI writes measured reports and returns failure for budgets or linked report outputs", async (t) => {
  const { root } = await fixture(t);
  await mkdir(path.join(root, "scripts"));
  const filename = path.join(root, "scripts/check-bundle-website.mjs");
  await copyFile(
    new URL("./check-bundle-website.mjs", import.meta.url),
    filename,
  );
  await writeFile(
    path.join(root, "performance-budget.json"),
    JSON.stringify(budget),
  );
  const run = () =>
    spawnSync(process.execPath, [filename], {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
  assert.equal(run().status, 0);
  const measured = JSON.parse(
    await readFile(
      path.join(root, ".lighthouseci/website/bundle.json"),
      "utf8",
    ),
  );
  assert.equal(measured.javaScriptBytes, 150);
  assert.equal(run().status, 0);
  await writeFile(
    path.join(root, "performance-budget.json"),
    JSON.stringify({ ...budget, totalJavaScriptBytes: 0 }),
  );
  const failed = run();
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /exceeds/);
  await rm(path.join(root, ".lighthouseci"), { recursive: true });
  const outside = path.join(root, "owned-outside");
  await mkdir(outside);
  await symlink(outside, path.join(root, ".lighthouseci"), "junction");
  const linked = run();
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /symbolic links/);
});

test("performance child environments allowlist runtime essentials and require explicit loopback ports", () => {
  const inherited = {
    PATH: "path",
    SystemRoot: "system",
    TEMP: "temp",
    TMP: "tmp",
    API_BASE_URL: "https://owner.test",
    DATABASE_URL: "private",
    NEXT_PUBLIC_COLLECTOR: "private",
    WEBSITE_INDEXING_ENABLED: "true",
    NODE_OPTIONS: "--require=private",
  };
  const env = websitePerformanceEnvironment("http://127.0.0.1:3198", inherited);
  assert.equal(env.API_BASE_URL, "http://127.0.0.1:3198");
  assert.equal(env.WEBSITE_INDEXING_ENABLED, "false");
  assert.equal(env.KERNEL_SYNTHETIC_ENV, "1");
  assert.equal(env.SystemRoot, "system");
  for (const key of ["NODE_OPTIONS", "DATABASE_URL", "NEXT_PUBLIC_COLLECTOR"])
    assert.equal(env[key], undefined);
  assert.equal(
    websitePerformanceEnvironment("http://127.0.0.1:3198", {}).PATH,
    "",
  );
  for (const origin of [
    "invalid",
    "https://127.0.0.1:3198",
    "http://127.0.0.1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:3100/path",
    "http://user@127.0.0.1:3100",
    "http://127.0.0.1:3100?q=1",
    "http://127.0.0.1:3100/#x",
    "http://localhost:3100",
  ])
    assert.throws(
      () => websitePerformanceEnvironment(origin, {}),
      /isolated IPv4/,
    );
});

test("dotenv preflight checks presence only and rejects linked or invalid website directories", async (t) => {
  const { root } = await fixture(t);
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await writeFile(
    path.join(root, ".env.example"),
    "SYNTHETIC_EXAMPLE=not-read\n",
  );
  assert.doesNotThrow(() => assertCleanWebsiteEnvironment(root));
  await writeFile(
    path.join(root, ".env.production.local"),
    "SYNTHETIC_ONLY=not-read\n",
  );
  assert.throws(
    () => assertCleanWebsiteEnvironment(root),
    /No file was read or changed/,
  );
  const alias = path.join(root, "alias");
  await symlink(path.join(root, ".next"), alias, "junction");
  assert.throws(() => assertCleanWebsiteEnvironment(alias), /unlinked owned/);
  assert.throws(
    () => assertCleanWebsiteEnvironment(path.join(root, "performance-file")),
    /ENOENT/,
  );
});
