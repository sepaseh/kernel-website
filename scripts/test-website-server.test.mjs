import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { runTestWebsiteServer } from "./test-website-server.mjs";

const environment = () => ({
  NODE_ENV: "production",
  KERNEL_SYNTHETIC_ENV: "1",
  API_BASE_URL: "http://127.0.0.1:43101",
  WEBSITE_URL: "http://127.0.0.1:43102",
  HOSTNAME: "127.0.0.1",
  PORT: "43102",
  WEBSITE_INDEXING_ENABLED: "false",
  WEBSITE_CSP_MODE: "enforce",
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
});

async function fixture(t, scenario = {}) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-owned-server-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-owned-server-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(
      filename,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: scenario.ready ?? true,
  });
  await put("package.json", {
    name: "kernel-website",
    dependencies: { next: "16.4.3" },
  });
  const server = `
const fs = require('node:fs');
const path = require('node:path');
if (fs.readFileSync(path.join(__dirname, 'public/logo.svg'), 'utf8') !== 'owned-public') throw new Error('public assets not prepared');
if (fs.readFileSync(path.join(__dirname, '.next/static/chunk.js'), 'utf8') !== 'owned-static') throw new Error('static assets not prepared');
fs.appendFileSync('trace.jsonl', JSON.stringify({kind:'server',csp:process.env.WEBSITE_CSP_MODE, nodeOptions:process.env.NODE_OPTIONS ?? null, database:process.env.DATABASE_URL ?? null})+'\\n');
${scenario.server === "hold" ? "setInterval(() => {}, 1000);" : scenario.server === "fail" ? "process.exitCode = 9;" : ""}
`;
  const populateBuild = async () => {
    await put(".next/BUILD_ID", "owned-build");
    await put(".next/static/chunk.js", "owned-static");
    await put("public/logo.svg", "owned-public");
    await put(".next/standalone/server.js", server);
  };
  if (scenario.next !== false) {
    await put("package-lock.json", {
      lockfileVersion: 3,
      packages: {
        "": { name: "kernel-website", dependencies: { next: "16.4.3" } },
        "node_modules/next": { version: "16.4.3" },
      },
    });
    await put("node_modules/next/package.json", {
      name: "next",
      version: "16.4.3",
    });
    await put(
      "node_modules/next/dist/bin/next",
      `
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync('trace.jsonl', JSON.stringify({kind:'build',args:process.argv.slice(2), csp:process.env.WEBSITE_CSP_MODE,nodeOptions:process.env.NODE_OPTIONS ?? null,database:process.env.DATABASE_URL ?? null})+'\\n');
${
  scenario.build === "fail"
    ? "process.exitCode=7;"
    : scenario.build === "hold"
      ? "setInterval(() => {},1000);"
      : `for (const [filename, content] of ${JSON.stringify([
          [".next/BUILD_ID", "owned-build"],
          [".next/static/chunk.js", "owned-static"],
          ["public/logo.svg", "owned-public"],
          [".next/standalone/server.js", server],
        ])}) {fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content);}`
}
`,
    );
  }
  const trace = async () => {
    try {
      return (await readFile(path.join(root, "trace.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  };
  return { root, put, populateBuild, trace };
}

async function waitForKind(trace, kind) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if ((await trace()).some((entry) => entry.kind === kind)) return;
    await setTimeout(10);
  }
  throw new Error(`Owned fixture did not reach ${kind}.`);
}

async function copyCli(put) {
  for (const name of [
    "test-website-server.mjs",
    "runner-inputs.mjs",
    "runner-process.mjs",
    "prepare-standalone.mjs",
    "release-files.mjs",
    "api-repository.mjs",
    "validate-deployment-env.mjs",
    "website-performance-environment.mjs",
  ])
    await put(
      `scripts/${name}`,
      await readFile(new URL(name, import.meta.url), "utf8"),
    );
}

test("server wrapper is a pure import and its CLI gates phase before arguments or Next lookup", async (t) => {
  const { root, put } = await fixture(t, { ready: false, next: false });
  await copyCli(put);
  const filename = path.join(root, "scripts/test-website-server.mjs");
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(pathToFileURL(filename).href)});`,
    ],
    {
      cwd: root,
      env: environment(),
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    },
  );
  assert.equal(imported.error, undefined);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, "");
  const invoked = spawnSync(process.execPath, [filename, "--unexpected"], {
    cwd: root,
    env: environment(),
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  assert.equal(invoked.error, undefined);
  assert.equal(invoked.status, 1);
  assert.match(
    invoked.stderr,
    /applicationReady|application.*ready|bootstrap/i,
  );
  assert.doesNotMatch(invoked.stderr, /ENOENT|arguments/);
});

test("server readiness and pre-abort precede configuration access", async (t) => {
  const { root, put, trace } = await fixture(t, { ready: false, next: false });
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("options accessed");
      },
    },
  );
  await assert.rejects(
    runTestWebsiteServer(root, poison),
    /applicationReady|bootstrap/i,
  );
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: true,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runTestWebsiteServer(root, {
      signal: controller.signal,
      get environment() {
        throw new Error("environment accessed");
      },
    }),
    { name: "AbortError" },
  );
  await assert.rejects(
    runTestWebsiteServer(root, { signal: {} }),
    /AbortSignal/,
  );
  assert.deepEqual(await trace(), []);
});

test("owned build completes, assets are prepared, and only then the server starts with public settings", async (t) => {
  const { root, trace } = await fixture(t);
  await runTestWebsiteServer(root, {
    environment: {
      ...environment(),
      WEBSITE_TEST_CSP_MODE: "report-only",
      NODE_OPTIONS: "--invalid-owned-fixture-option",
      DATABASE_URL: "synthetic-must-not-pass",
    },
  });
  const entries = await trace();
  assert.deepEqual(
    entries.map(({ kind }) => kind),
    ["build", "server"],
  );
  assert.deepEqual(entries[0].args, ["build"]);
  for (const entry of entries) {
    assert.equal(entry.csp, "report-only");
    assert.equal(entry.nodeOptions, null);
    assert.equal(entry.database, null);
  }
});

test("failed or cancelled owned builds never prepare or start a server", async (t) => {
  const failed = await fixture(t, { build: "fail" });
  await assert.rejects(
    runTestWebsiteServer(failed.root, { environment: environment() }),
    /7/,
  );
  assert.deepEqual(
    (await failed.trace()).map(({ kind }) => kind),
    ["build"],
  );
  await assert.rejects(stat(path.join(failed.root, ".next/standalone")), {
    code: "ENOENT",
  });
  const cancelled = await fixture(t, { build: "hold" });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const outcome = assert.rejects(
    runTestWebsiteServer(cancelled.root, {
      environment: environment(),
      signal: controller.signal,
    }),
    /abort/i,
  );
  await waitForKind(cancelled.trace, "build");
  controller.abort();
  await outcome;
  assert.deepEqual(
    (await cancelled.trace()).map(({ kind }) => kind),
    ["build"],
  );
  await assert.rejects(stat(path.join(cancelled.root, ".next/standalone")), {
    code: "ENOENT",
  });
});

test("skip-build requires bounded public BUILD_ID and does not resolve an unused Next CLI", async (t) => {
  const { root, put, populateBuild, trace } = await fixture(t, { next: false });
  for (const value of [null, "", " \n", "bad\0id", "a".repeat(1025)]) {
    if (value !== null) await put(".next/BUILD_ID", value);
    await assert.rejects(
      runTestWebsiteServer(root, {
        environment: environment(),
        skipBuild: true,
      }),
    );
    assert.deepEqual(await trace(), []);
  }
  await populateBuild();
  await runTestWebsiteServer(root, {
    environment: { ...environment(), WEBSITE_SKIP_BUILD: "1" },
  });
  assert.deepEqual(
    (await trace()).map(({ kind }) => kind),
    ["server"],
  );
});

test("invalid build switches and CSP modes fail without spawning", async (t) => {
  const { root, trace } = await fixture(t);
  for (const options of [
    { skipBuild: "yes" },
    { environment: { ...environment(), WEBSITE_SKIP_BUILD: "yes" } },
    { environment: { ...environment(), WEBSITE_TEST_CSP_MODE: "disabled" } },
  ])
    await assert.rejects(
      runTestWebsiteServer(root, { environment: environment(), ...options }),
      /skipBuild|WEBSITE_SKIP_BUILD|CSP/,
    );
  assert.deepEqual(await trace(), []);
});

test("skip-build snapshots a boolean getter once before choosing the build", async (t) => {
  const { root, trace } = await fixture(t);
  let reads = 0;
  await runTestWebsiteServer(root, {
    environment: environment(),
    get skipBuild() {
      reads += 1;
      return reads === 1 ? false : true;
    },
  });
  assert.equal(reads, 1);
  assert.deepEqual(
    (await trace()).map(({ kind }) => kind),
    ["build", "server"],
  );
});

test("server failure and cancellation remain failures after a successful build", async (t) => {
  const failed = await fixture(t, { server: "fail" });
  await assert.rejects(
    runTestWebsiteServer(failed.root, { environment: environment() }),
    /9/,
  );
  const cancelled = await fixture(t, { server: "hold" });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const outcome = assert.rejects(
    runTestWebsiteServer(cancelled.root, {
      environment: environment(),
      signal: controller.signal,
    }),
    /abort/i,
  );
  await waitForKind(cancelled.trace, "server");
  controller.abort();
  await outcome;
  assert.deepEqual(
    (await cancelled.trace()).map(({ kind }) => kind),
    ["build", "server"],
  );
});
