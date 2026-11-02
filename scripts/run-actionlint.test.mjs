import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  open,
  readdir,
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
  actionlintAsset,
  actionlintVersion,
  runActionlint,
  verifyActionlintArchive,
} from "./run-actionlint.mjs";

const syntheticArchive = Buffer.from("synthetic reviewed archive");
const fixture = async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-actionlint-"));
  context.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("kernel-actionlint-"));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, ".github/workflows"), { recursive: true });
  await mkdir(path.join(root, "scripts"));
  await writeFile(path.join(root, ".github/workflows/ci.yml"), "name: CI\n");
  await writeFile(
    path.join(root, ".github/workflows/codeql.yaml"),
    "name: CodeQL\n",
  );
  await writeFile(
    path.join(root, "scripts/historical.test.yml"),
    "invalid fixture",
  );
  const asset = {
    ...actionlintAsset("linux", "x64"),
    sha256: createHash("sha256").update(syntheticArchive).digest("hex"),
  };
  const requests = [];
  const executions = [];
  const request = async (url) => {
    requests.push(url);
    return {
      ok: true,
      arrayBuffer: async () => Uint8Array.from(syntheticArchive).buffer,
    };
  };
  const execute = (filename, args, options) => {
    executions.push({ filename, args, options });
    if (filename === asset.extractor)
      writeFileSync(
        path.join(options.cwd, asset.executable),
        "synthetic binary",
      );
    return { status: 0 };
  };
  const cache = path.join(root, "coverage/tools/actionlint", actionlintVersion);
  return { root, asset, request, execute, requests, executions, cache };
};

test("selects only reviewed official Windows and Linux x64 binaries", () => {
  const windows = actionlintAsset("win32", "x64");
  const linux = actionlintAsset("linux", "x64");
  assert.equal(actionlintVersion, "1.7.12");
  assert.equal(windows.executable, "actionlint.exe");
  assert.equal(linux.executable, "actionlint");
  for (const asset of [windows, linux]) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      asset.url,
      `https://github.com/rhysd/actionlint/releases/download/v1.7.12/${asset.name}`,
    );
  }
  assert.throws(() => actionlintAsset("linux", "arm64"), /No reviewed/);
  assert.throws(() => actionlintAsset("darwin", "x64"), /No reviewed/);
});

test("rejects changed, empty and oversized archives before execution", () => {
  const digest = createHash("sha256").update(syntheticArchive).digest("hex");
  verifyActionlintArchive(syntheticArchive, digest);
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.from("tampered"),
    Buffer.alloc(17 * 1024 * 1024),
  ])
    assert.throws(
      () => verifyActionlintArchive(bytes, digest),
      /pinned SHA-256/,
    );
});

test("lints actual workflow files once using fresh extraction and verified archive caching", async (context) => {
  const value = await fixture(context);
  assert.equal(await runActionlint(value), 0);
  assert.equal(value.requests.length, 1);
  const lint = value.executions[1];
  assert.deepEqual(lint.args, [
    "-shellcheck=",
    "-pyflakes=",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yaml",
  ]);
  assert.equal(lint.options.cwd, value.root);
  assert.deepEqual(await readdir(value.cache), [value.asset.name]);
  assert.deepEqual(
    await readFile(path.join(value.cache, value.asset.name)),
    syntheticArchive,
  );
  assert.equal(await runActionlint(value), 0);
  assert.equal(value.requests.length, 1);
  assert.equal(value.executions.length, 4);
  assert.notEqual(value.executions[1].filename, value.executions[3].filename);
});

test("tampered downloads and cached archives cannot reach extraction", async (context) => {
  const value = await fixture(context);
  await assert.rejects(
    runActionlint({
      ...value,
      request: async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    }),
    /pinned SHA-256/,
  );
  assert.equal(value.executions.length, 0);
  await runActionlint(value);
  value.executions.length = 0;
  await writeFile(path.join(value.cache, value.asset.name), "tampered cache");
  await assert.rejects(runActionlint(value), /pinned SHA-256/);
  assert.equal(value.executions.length, 0);
});

test("reads the checked cache handle even if its pathname is replaced", async (context) => {
  const value = await fixture(context);
  await runActionlint(value);
  value.executions.length = 0;
  const filename = path.join(value.cache, value.asset.name);
  const probe = await open(filename, "r");
  const prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const originalRead = prototype.readFile;
  const replaced = context.mock.method(
    prototype,
    "readFile",
    async function (...args) {
      await rename(filename, path.join(value.cache, "original-archive"));
      await writeFile(filename, "replacement archive");
      return originalRead.apply(this, args);
    },
  );

  assert.equal(await runActionlint(value), 0);
  replaced.mock.restore();
  assert.equal(value.requests.length, 1);
  assert.equal(value.executions.length, 2);
  assert.equal(await readFile(filename, "utf8"), "replacement archive");
});

test("exclusive cache creation rejects a competing file without overwriting it", async (context) => {
  const value = await fixture(context);
  const competing = Buffer.from("competing cache entry");
  const filename = path.join(value.cache, value.asset.name);
  const request = async (url) => {
    await writeFile(filename, competing, { flag: "wx" });
    return value.request(url);
  };

  await assert.rejects(
    runActionlint({ ...value, request }),
    (error) => error.code === "EEXIST",
  );
  assert.deepEqual(await readFile(filename), competing);
  assert.equal(value.executions.length, 0);
});

test("rejects non-file and oversized cached archives before extraction", async (context) => {
  const value = await fixture(context);
  await runActionlint(value);
  value.executions.length = 0;
  const filename = path.join(value.cache, value.asset.name);
  await rm(filename);
  await mkdir(filename);
  await assert.rejects(runActionlint(value), /ordinary file/);
  await rm(filename, { recursive: true });
  if (process.platform === "linux") {
    const fifo = spawnSync("/usr/bin/mkfifo", [filename]);
    assert.ifError(fifo.error);
    assert.equal(fifo.status, 0);
    await assert.rejects(runActionlint(value), /ordinary file/);
    await rm(filename);
  }
  await writeFile(filename, Buffer.alloc(17 * 1024 * 1024));
  await assert.rejects(runActionlint(value), /exceeds its size limit/);
  assert.equal(value.executions.length, 0);
});

test("download errors fail closed without executing or leaving extraction directories", async (context) => {
  const value = await fixture(context);
  const outage = new Error("synthetic network outage");
  await assert.rejects(
    runActionlint({
      ...value,
      request: async () => {
        throw outage;
      },
    }),
    (error) => error === outage,
  );
  await assert.rejects(
    runActionlint({
      ...value,
      request: async () => ({ ok: false, status: 503 }),
    }),
    /HTTP 503/,
  );
  assert.equal(value.executions.length, 0);
  assert.deepEqual(await readdir(value.cache), []);
});

test("preserves linter exit status and native execution failures while cleaning owned files", async (context) => {
  const value = await fixture(context);
  const execute = (...args) => {
    const result = value.execute(...args);
    return args[0] === value.asset.extractor ? result : { status: 2 };
  };
  assert.equal(await runActionlint({ ...value, execute }), 2);
  assert.deepEqual(await readdir(value.cache), [value.asset.name]);
  const unavailable = new Error("synthetic executable failure");
  await assert.rejects(
    runActionlint({ ...value, execute: () => ({ error: unavailable }) }),
    (error) => error === unavailable,
  );
  await assert.rejects(
    runActionlint({ ...value, execute: () => ({ status: 1 }) }),
    /extraction failed/,
  );
  await assert.rejects(
    runActionlint({
      ...value,
      execute: (...args) => {
        const result = value.execute(...args);
        return args[0] === value.asset.extractor
          ? result
          : { status: null, signal: "SIGTERM" };
      },
    }),
    /did not complete/,
  );
  assert.deepEqual(await readdir(value.cache), [value.asset.name]);
});

test("rejects missing workflows and linked source or cache directories", async (context) => {
  const value = await fixture(context);
  await rm(path.join(value.root, ".github/workflows"), { recursive: true });
  await mkdir(path.join(value.root, ".github/workflows"));
  await assert.rejects(runActionlint(value), /No actual GitHub/);
  await mkdir(path.join(value.root, "external"));
  await rm(path.join(value.root, ".github/workflows"), { recursive: true });
  await symlink(
    path.join(value.root, "external"),
    path.join(value.root, ".github/workflows"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(runActionlint(value), /ordinary owned directories/);
  assert.equal(value.requests.length, 0);
});
