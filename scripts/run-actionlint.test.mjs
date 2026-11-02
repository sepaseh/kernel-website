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
import { pathToFileURL } from "node:url";

import {
  actionlintAsset,
  actionlintVersion,
  runActionlint,
  verifyActionlintArchive,
} from "./run-actionlint.mjs";

const syntheticArchive = Buffer.from("synthetic reviewed archive");
const fixture = async (
  context,
  { platform = "linux", architecture = "x64" } = {},
) => {
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
    ...actionlintAsset(platform, architecture),
    sha256: createHash("sha256").update(syntheticArchive).digest("hex"),
  };
  const requests = [];
  const executions = [];
  const request = async (url) => {
    requests.push(url);
    return new Response(syntheticArchive);
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
  assert.equal(windows.extractor, String.raw`C:\Windows\System32\tar.exe`);
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
      request: async () => new Response(new Uint8Array([1, 2, 3])),
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

test("extracts and lints the Windows asset through the reviewed extractor", async (context) => {
  const value = await fixture(context, { platform: "win32" });
  assert.equal(await runActionlint(value), 0);
  assert.equal(
    value.executions[0].filename,
    String.raw`C:\Windows\System32\tar.exe`,
  );
  assert.equal(value.executions[0].args.at(-1), "actionlint.exe");
  assert.equal(path.basename(value.executions[1].filename), "actionlint.exe");
});

test("resolves a relative source root before extracting and linting", async (context) => {
  const value = await fixture(context);
  const previous = process.cwd();
  try {
    process.chdir(path.dirname(value.root));
    assert.equal(
      await runActionlint({ ...value, root: path.basename(value.root) }),
      0,
    );
  } finally {
    process.chdir(previous);
  }
  const extraction = value.executions[0];
  assert.ok(path.isAbsolute(extraction.args[1]));
  assert.ok(path.isAbsolute(extraction.args[3]));
  assert.equal(extraction.options.cwd, extraction.args[3]);
  assert.equal(value.executions[1].options.cwd, value.root);
});

test("caps streamed downloads and cancels oversized bodies without trusting Content-Length", async (context) => {
  const value = await fixture(context);
  for (const headers of [undefined, { "content-length": "1" }]) {
    const chunks = [
      Buffer.alloc(8 * 1024 * 1024),
      Buffer.alloc(9 * 1024 * 1024),
      Buffer.from("must not be read"),
    ];
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream(
      {
        pull(controller) {
          if (pulls < chunks.length) controller.enqueue(chunks[pulls++]);
          else controller.close();
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );

    await assert.rejects(
      runActionlint({
        ...value,
        request: async () => new Response(body, { headers }),
      }),
      /download exceeds its size limit/,
    );
    assert.equal(pulls, 2);
    assert.equal(cancelled, true);
  }
  assert.equal(value.executions.length, 0);
  assert.deepEqual(await readdir(value.cache), []);
});

test("verifies bounded multi-chunk bodies and rejects a missing body", async (context) => {
  const value = await fixture(context);
  await assert.rejects(
    runActionlint({ ...value, request: async () => new Response(null) }),
    /pinned SHA-256/,
  );
  assert.equal(value.executions.length, 0);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(syntheticArchive.subarray(0, 5));
      controller.enqueue(syntheticArchive.subarray(5));
      controller.close();
    },
  });
  assert.equal(
    await runActionlint({ ...value, request: async () => new Response(body) }),
    0,
  );
});

test("download expiry aborts a pending request without waiting for wall time", async (context) => {
  const value = await fixture(context);
  const expiry = new AbortController();
  const started = Promise.withResolvers();
  const reason = new DOMException("synthetic download expiry", "TimeoutError");
  context.mock.method(AbortSignal, "timeout", () => expiry.signal);
  const operation = runActionlint({
    ...value,
    request: (url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        started.resolve(url);
      }),
  });

  await Promise.race([started.promise, operation]);
  const rejected = assert.rejects(operation, (error) => error === reason);
  expiry.abort(reason);
  await rejected;
  assert.equal(value.executions.length, 0);
  assert.deepEqual(await readdir(value.cache), []);
});

test("download expiry also aborts a pending response-body read", async (context) => {
  const value = await fixture(context);
  const expiry = new AbortController();
  const reading = Promise.withResolvers();
  const reason = new DOMException("synthetic body expiry", "TimeoutError");
  context.mock.method(AbortSignal, "timeout", () => expiry.signal);
  const operation = runActionlint({
    ...value,
    request: async (url, { signal }) =>
      new Response(
        new ReadableStream(
          {
            start(controller) {
              signal.addEventListener(
                "abort",
                () => controller.error(signal.reason),
                {
                  once: true,
                },
              );
            },
            pull() {
              reading.resolve(url);
            },
          },
          { highWaterMark: 0 },
        ),
      ),
  });

  await Promise.race([reading.promise, operation]);
  const rejected = assert.rejects(operation, (error) => error === reason);
  expiry.abort(reason);
  await rejected;
  assert.equal(value.executions.length, 0);
  assert.deepEqual(await readdir(value.cache), []);
});

test("CLI failure output retains AggregateError causes", async (context) => {
  const value = await fixture(context);
  const entry = path.join(value.root, "scripts/run-actionlint.mjs");
  const preload = path.join(value.root, "scripts/failing-fetch.mjs");
  await writeFile(
    entry,
    await readFile(new URL("./run-actionlint.mjs", import.meta.url)),
  );
  await writeFile(
    preload,
    `globalThis.fetch = async () => {
      throw new AggregateError([
        new Error("synthetic execution cause"),
        new Error("synthetic cleanup cause"),
      ], "actionlint and cleanup both failed");
    };\n`,
  );

  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preload).href, entry],
    { cwd: value.root, encoding: "utf8", windowsHide: true },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /actionlint and cleanup both failed/);
  assert.match(result.stderr, /synthetic execution cause/);
  assert.match(result.stderr, /synthetic cleanup cause/);
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
