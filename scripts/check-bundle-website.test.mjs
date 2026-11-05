import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import {
  clientAssetPath,
  evaluateWebsiteBudget,
  measureWebsiteBundle,
  parseClientManifest,
} from "./check-bundle-website.mjs";

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
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "website-bundle-test-")),
  );
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

test("bundle manifests measure emitted JavaScript and CSS names containing tildes", async (t) => {
  const { build, write } = await fixture(t);
  const javaScript = "static/chunks/0259pyb8~2v.js";
  const css = "static/chunks/style~2v.css";
  await Promise.all([
    rename(
      path.join(build, "static/chunks/page.js"),
      path.join(build, javaScript),
    ),
    rename(path.join(build, "static/chunks/style.css"), path.join(build, css)),
  ]);
  const graph = {
    clientModules: {
      a: { chunks: [`/_next/${javaScript}`] },
      b: { chunks: [javaScript] },
    },
    entryCSSFiles: {
      layout: [{ path: `/_next/${css}` }],
      legacy: [css],
    },
  };
  await Promise.all(
    ["page", "nested/page"].map((name) =>
      write(
        `server/app/${name}_client-reference-manifest.js`,
        assignment(graph),
      ),
    ),
  );

  const result = await measureWebsiteBundle(build);

  assert.equal(result.javaScriptBytes, 150);
  assert.equal(result.largestJavaScriptBytes, 100);
  assert.equal(result.cssBytes, 20);
  assert.deepEqual(result.files, [javaScript, "static/chunks/shared.js", css]);
  for (const route of ["/", "/nested"]) {
    assert.equal(result.routes[route].javaScriptBytes, 150);
    assert.equal(result.routes[route].cssBytes, 20);
    assert.deepEqual(result.routes[route].files, result.files);
  }
});

test("entry JavaScript joins both route graphs, deduplicates and cannot bypass route budgets", async (t) => {
  const { build, write } = await fixture(t);
  const entry = "static/chunks/entry~route.js";
  const contents = "entry".repeat(12);
  await write(entry, contents);
  const graph = {
    ...clientGraph(),
    entryJSFiles: {
      layout: ["/_next/static/chunks/shared.js", entry],
      page: [`/_next/${entry}`, "static/chunks/page.js"],
    },
  };
  await Promise.all(
    ["page", "nested/page"].map((name) =>
      write(
        `server/app/${name}_client-reference-manifest.js`,
        assignment(graph),
      ),
    ),
  );

  const result = await measureWebsiteBundle(build);
  const expectedBytes = 150 + Buffer.byteLength(contents);
  const expectedGzipBytes = ["x".repeat(100), "y".repeat(50), contents].reduce(
    (total, source) => total + gzipSync(source, { level: 9 }).length,
    0,
  );
  const expectedFiles = [
    entry,
    "static/chunks/page.js",
    "static/chunks/shared.js",
    "static/chunks/style.css",
  ];
  assert.equal(result.javaScriptBytes, expectedBytes);
  assert.equal(result.javaScriptGzipBytes, expectedGzipBytes);
  assert.equal(result.largestJavaScriptBytes, 100);
  for (const route of ["/", "/nested"]) {
    assert.equal(result.routes[route].javaScriptBytes, expectedBytes);
    assert.equal(result.routes[route].javaScriptGzipBytes, expectedGzipBytes);
    assert.equal(result.routes[route].cssBytes, 20);
    assert.deepEqual(result.routes[route].files, expectedFiles);
  }
  assert.deepEqual(
    evaluateWebsiteBudget(result, {
      ...budget,
      totalJavaScriptBytes: expectedBytes,
      routeJavaScriptGzipBytes: expectedGzipBytes,
    }).sort(),
    [
      `/ client graph JavaScript: ${expectedBytes} bytes exceeds 150`,
      `/nested client graph JavaScript: ${expectedBytes} bytes exceeds 150`,
    ],
  );
});

test("optional entry JavaScript accepts missing or empty maps and rejects malformed lists", () => {
  assert.deepEqual(
    parseClientManifest(assignment({ ...clientGraph(), entryJSFiles: {} })),
    { ...clientGraph(), entryJSFiles: {} },
  );
  for (const entryJSFiles of [
    null,
    [],
    "not-an-object",
    0,
    { page: "static/chunks/page.js" },
    { page: [1] },
    { page: [null] },
    { page: [{}] },
  ])
    assert.throws(
      () => parseClientManifest(assignment({ ...clientGraph(), entryJSFiles })),
      /Invalid Next client entry JavaScript list/,
    );
});

test("entry JavaScript rejects unsafe and missing assets through the common asset boundary", async (t) => {
  const { build, write } = await fixture(t);
  for (const [entry, error] of [
    ["static/../private.js", /Not a browser JS\/CSS asset/],
    ["https://external.test/entry.js", /Not a browser JS\/CSS asset/],
    ["static/chunks/missing.js", /Missing browser asset/],
  ]) {
    await write(
      "server/app/page_client-reference-manifest.js",
      assignment({ ...clientGraph(), entryJSFiles: { page: [entry] } }),
    );
    await assert.rejects(measureWebsiteBundle(build), error);
  }
});

test("bundle output preserves UTF-16 lexical order without locale-dependent sorting", async (t) => {
  const { build, write } = await fixture(t);
  await mkdir(path.join(build, "server/app/page(foo)"));
  for (const name of ["Z", "_lower", "a"])
    await write(`static/chunks/${name}.js`, name);
  const graph = clientGraph([
    "static/chunks/a.js",
    "static/chunks/_lower.js",
    "static/chunks/Z.js",
  ]);
  await write(
    "server/app/page_client-reference-manifest.js",
    assignment(graph),
  );
  await write(
    "server/app/page(foo)/page_client-reference-manifest.js",
    assignment(graph),
  );
  await write("app-path-routes-manifest.json", {
    "/page": "/",
    "/page(foo)/page": "/edge",
  });
  const result = await measureWebsiteBundle(build);
  assert.deepEqual(Object.keys(result.routes), ["/edge", "/"]);
  assert.deepEqual(result.routes["/"].files, [
    "static/chunks/Z.js",
    "static/chunks/_lower.js",
    "static/chunks/a.js",
    "static/chunks/page.js",
    "static/chunks/shared.js",
    "static/chunks/style.css",
  ]);
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
    "static/~/../private.js",
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
  await mkdir(path.join(root, ".github"));
  await writeFile(
    path.join(root, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: true }),
  );
  const filename = path.join(root, "scripts/check-bundle-website.mjs");
  await copyFile(
    new URL("./check-bundle-website.mjs", import.meta.url),
    filename,
  );
  await copyFile(
    new URL("./release-files.mjs", import.meta.url),
    path.join(root, "scripts/release-files.mjs"),
  );
  await writeFile(
    path.join(root, "performance-budget.json"),
    JSON.stringify(budget),
  );
  const run = () =>
    spawnSync(process.execPath, [filename], {
      encoding: "utf8",
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

test("bundle CLI rejects false readiness before reading build inputs or creating reports", async (t) => {
  const { root, write } = await fixture(t);
  await mkdir(path.join(root, "scripts"));
  await mkdir(path.join(root, ".github"));
  await writeFile(
    path.join(root, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: false }),
  );
  for (const name of ["check-bundle-website.mjs", "release-files.mjs"])
    await copyFile(
      new URL(`./${name}`, import.meta.url),
      path.join(root, "scripts", name),
    );
  await write(
    "build-manifest.json",
    "Malformed build input must remain unread",
  );
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/check-bundle-website.mjs")],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /applicationReady:true/);
  await assert.rejects(
    readFile(path.join(root, ".lighthouseci/website/bundle.json")),
    { code: "ENOENT" },
  );
});
