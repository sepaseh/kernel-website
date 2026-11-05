import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { analyzeWebsitePerformance } from "./analyze-website-performance.mjs";
import { abortOnFixtureFile } from "./runner.test-support.mjs";

const environment = () => ({
  NODE_ENV: "production",
  KERNEL_SYNTHETIC_ENV: "1",
  API_BASE_URL: "http://127.0.0.1:43201",
  WEBSITE_URL: "http://127.0.0.1:43202",
  HOSTNAME: "127.0.0.1",
  PORT: "43202",
  WEBSITE_INDEXING_ENABLED: "false",
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
});

async function fixture(t, scenario = "good", ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-owned-analyzer-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-owned-analyzer-"));
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
    applicationReady: ready,
  });
  await put("package.json", {
    name: "kernel-website",
    dependencies: { next: "16.4.3" },
  });
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
const args=process.argv.slice(2);
fs.appendFileSync('trace.jsonl',JSON.stringify({args,nodeOptions:process.env.NODE_OPTIONS??null,database:process.env.DATABASE_URL??null})+'\\n');
if (args[1] === 'export') {
${scenario === "empty" ? "" : `process.stdout.write(${JSON.stringify(scenario === "oversize" ? "x".repeat(128) : '{"owned":true}\n')}${scenario === "unreadable-readiness" ? ",()=>fs.mkdirSync('broken-marker')" : ""});`}
${scenario === "nonzero" ? "process.exitCode=7;" : ""}
${["hold", "oversize", "broken-readiness", "unreadable-readiness"].includes(scenario) ? "require('node:net').createServer().listen(0,'127.0.0.1');fs.writeFileSync('export-started.tmp','ready');fs.renameSync('export-started.tmp','export-started');" : ""}
${scenario === "replace" ? "fs.renameSync('.lighthouseci/website/graph.jsonl','.lighthouseci/website/graph.jsonl.moved');fs.writeFileSync('.lighthouseci/website/graph.jsonl','unrelated-replacement');" : ""}
${scenario === "broken-readiness" ? "fs.renameSync('.lighthouseci/website/graph.jsonl','.lighthouseci/website/graph.jsonl.moved');fs.writeFileSync('.lighthouseci/website/graph.jsonl','unrelated-replacement');fs.mkdirSync('broken-marker');" : ""}
}
`,
  );
  const graph = path.join(root, ".lighthouseci/website/graph.jsonl");
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
  return { root, put, graph, trace };
}

async function assertRemovedAndClosed(filename) {
  await assert.rejects(stat(filename), { code: "ENOENT" });
  const replacement = await open(filename, "wx");
  await replacement.close();
  await rm(filename);
}

async function copyCli(put) {
  for (const name of [
    "analyze-website-performance.mjs",
    "runner-inputs.mjs",
    "runner-process.mjs",
    "release-files.mjs",
    "validate-deployment-env.mjs",
    "website-performance-environment.mjs",
  ])
    await put(
      `scripts/${name}`,
      await readFile(new URL(name, import.meta.url), "utf8"),
    );
}

test("analyzer import has no operation and CLI readiness precedes argument parsing", async (t) => {
  const { root, put, trace } = await fixture(t, "good", false);
  await copyCli(put);
  const filename = path.join(root, "scripts/analyze-website-performance.mjs");
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
      windowsHide: true,
    },
  );
  assert.equal(imported.error, undefined);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, "");
  const invoked = spawnSync(process.execPath, [filename, "--unknown"], {
    cwd: root,
    env: environment(),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(invoked.error, undefined);
  assert.equal(invoked.status, 1);
  assert.match(invoked.stderr, /applicationReady|bootstrap/i);
  assert.doesNotMatch(invoked.stderr, /Unknown option|ENOENT/);
  assert.deepEqual(await trace(), []);
});

test("analyzer readiness and pre-abort happen before configuration and dependencies", async (t) => {
  const { root, put, trace } = await fixture(t, "good", false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("options accessed");
      },
    },
  );
  await assert.rejects(
    analyzeWebsitePerformance(root, poison),
    /applicationReady|bootstrap/i,
  );
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: true,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    analyzeWebsitePerformance(root, {
      signal: controller.signal,
      get environment() {
        throw new Error("environment accessed");
      },
    }),
    { name: "AbortError" },
  );
  await assert.rejects(
    analyzeWebsitePerformance(root, { signal: {} }),
    /AbortSignal/,
  );
  assert.deepEqual(await trace(), []);
});

test("analyzer uses the installed CLI command shape and filtered public environment", async (t) => {
  const { root, graph, trace } = await fixture(t);
  await analyzeWebsitePerformance(root, {
    environment: {
      ...environment(),
      NODE_OPTIONS: "--invalid-owned-fixture-option",
      DATABASE_URL: "synthetic-must-not-pass",
    },
  });
  assert.deepEqual(await trace(), [
    {
      args: ["analyze", "--output", "--snapshot", "website"],
      nodeOptions: null,
      database: null,
    },
  ]);
  await assert.rejects(stat(graph), { code: "ENOENT" });
});

test("CLI export uses fixed exclusive output and rejects additional arguments", async (t) => {
  const { root, put, graph, trace } = await fixture(t);
  await copyCli(put);
  const filename = path.join(root, "scripts/analyze-website-performance.mjs");
  for (const args of [["--export", "extra"], ["--unknown"]]) {
    const rejected = spawnSync(process.execPath, [filename, ...args], {
      cwd: root,
      env: environment(),
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(rejected.error, undefined);
    assert.equal(rejected.status, 1);
  }
  assert.deepEqual(await trace(), []);
  const result = spawnSync(process.execPath, [filename, "--export"], {
    cwd: root,
    env: environment(),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Saved website analyzer graph/);
  assert.equal(await readFile(graph, "utf8"), '{"owned":true}\n');
  assert.deepEqual((await trace())[0].args, [
    "analyze",
    "export",
    "--snapshot",
    "website",
  ]);
  await assert.rejects(
    analyzeWebsitePerformance(root, {
      environment: environment(),
      exporting: true,
    }),
    { code: "EEXIST" },
  );
  assert.equal(await readFile(graph, "utf8"), '{"owned":true}\n');
  assert.equal((await trace()).length, 1);
});

test("failed and empty export remove only their claimed output and close it", async (t) => {
  for (const scenario of ["nonzero", "empty"]) {
    const { root, graph } = await fixture(t, scenario);
    await assert.rejects(
      analyzeWebsitePerformance(root, {
        environment: environment(),
        exporting: true,
      }),
      scenario === "nonzero" ? /7/ : /no graph data/,
    );
    await assertRemovedAndClosed(graph);
  }
});

test("bounded output and abort stop and drain actual owned exporters before cleanup", async (t) => {
  const oversized = await fixture(t, "oversize");
  await assert.rejects(
    analyzeWebsitePerformance(oversized.root, {
      environment: environment(),
      exporting: true,
      maximumOutputBytes: 8,
    }),
    /bounded output limit|artifact operations/i,
  );
  await assertRemovedAndClosed(oversized.graph);
  const held = await fixture(t, "hold");
  const controller = new AbortController();
  t.after(() => controller.abort());
  await assert.rejects(
    abortOnFixtureFile(held.root, "export-started", controller, () =>
      analyzeWebsitePerformance(held.root, {
        environment: environment(),
        exporting: true,
        signal: controller.signal,
      }),
    ),
    /abort/i,
  );
  await assertRemovedAndClosed(held.graph);
});

test("cancellation readiness reports an exporter that finishes or fails before publishing its marker", async (t) => {
  for (const scenario of ["good", "nonzero"]) {
    const { root, graph } = await fixture(t, scenario);
    const controller = new AbortController();
    await assert.rejects(
      abortOnFixtureFile(root, "missing-marker", controller, () =>
        analyzeWebsitePerformance(root, {
          environment: environment(),
          exporting: true,
          signal: controller.signal,
        }),
      ),
      scenario === "good" ? /finished before publishing missing-marker/ : /7/,
    );
    assert.equal(controller.signal.aborted, true);
    if (scenario === "good")
      assert.equal(await readFile(graph, "utf8"), '{"owned":true}\n');
    else await assertRemovedAndClosed(graph);
  }
});

test("an unreadable readiness marker cancels and drains its owned exporter", async (t) => {
  const { root, graph } = await fixture(t, "unreadable-readiness");
  const controller = new AbortController();
  await assert.rejects(
    abortOnFixtureFile(root, "broken-marker", controller, () =>
      analyzeWebsitePerformance(root, {
        environment: environment(),
        exporting: true,
        signal: controller.signal,
      }),
    ),
    { code: "EISDIR" },
  );
  assert.equal(controller.signal.aborted, true);
  await assert.rejects(stat(graph), { code: "ENOENT" });
});

test("readiness preserves an operation's original non-Error failure", async (t) => {
  const { root } = await fixture(t);
  for (const original of [undefined, null, false, 0, ""]) {
    const controller = new AbortController();
    let rejected = false;
    try {
      await abortOnFixtureFile(root, "missing-marker", controller, async () => {
        await analyzeWebsitePerformance(root, {
          environment: environment(),
          signal: controller.signal,
        });
        throw original;
      });
    } catch (error) {
      rejected = true;
      assert.equal(error, original);
    }
    assert.equal(rejected, true);
    assert.equal(controller.signal.aborted, true);
  }
});

test("readiness failure retains the owned exporter's distinct cleanup failure", async (t) => {
  const { root, graph } = await fixture(t, "broken-readiness");
  const controller = new AbortController();
  await assert.rejects(
    abortOnFixtureFile(root, "broken-marker", controller, () =>
      analyzeWebsitePerformance(root, {
        environment: environment(),
        exporting: true,
        signal: controller.signal,
      }),
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0].code, "EISDIR");
      assert.equal(error.cause, error.errors[0]);
      const messages = (value) => [
        value.message,
        ...(value.errors ?? []).flatMap(messages),
      ];
      assert.ok(messages(error).some((message) => /replaced/.test(message)));
      assert.ok(messages(error).some((message) => /aborted/.test(message)));
      return true;
    },
  );
  assert.equal(await readFile(graph, "utf8"), "unrelated-replacement");
});

test("spawn error closes the claimed output before removing it", async (t) => {
  const { root, graph } = await fixture(t);
  const executable = process.execPath;
  try {
    process.execPath = path.join(root, "missing-owned-node.exe");
    await assert.rejects(
      analyzeWebsitePerformance(root, {
        environment: environment(),
        exporting: true,
      }),
      /ENOENT|artifact operations/i,
    );
  } finally {
    process.execPath = executable;
  }
  await assertRemovedAndClosed(graph);
});

test("export refuses a replacement result and preserves the unrelated replacement", async (t) => {
  const { root, graph } = await fixture(t, "replace");
  await assert.rejects(
    analyzeWebsitePerformance(root, {
      environment: environment(),
      exporting: true,
    }),
    /owned output cleanup|replaced/i,
  );
  assert.equal(await readFile(graph, "utf8"), "unrelated-replacement");
  assert.equal(await readFile(`${graph}.moved`, "utf8"), '{"owned":true}\n');
});

test("linked output parents and invalid selections fail without starting analysis", async (t) => {
  const linked = await fixture(t);
  const target = await fixture(t);
  await mkdir(path.join(linked.root, ".lighthouseci"));
  await symlink(
    target.root,
    path.join(linked.root, ".lighthouseci/website"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    analyzeWebsitePerformance(linked.root, {
      environment: environment(),
      exporting: true,
    }),
    /link/i,
  );
  assert.deepEqual(await linked.trace(), []);
  await assert.rejects(stat(path.join(target.root, "graph.jsonl")), {
    code: "ENOENT",
  });
  const ordinary = await fixture(t);
  for (const options of [
    { exporting: "yes" },
    { maximumOutputBytes: 0 },
    { maximumOutputBytes: 64 * 1024 * 1024 + 1 },
  ])
    await assert.rejects(
      analyzeWebsitePerformance(ordinary.root, {
        environment: environment(),
        ...options,
      }),
      /explicit boolean|output limit/i,
    );
  assert.deepEqual(await ordinary.trace(), []);
});
