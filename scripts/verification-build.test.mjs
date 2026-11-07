import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import fsPromises, {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { prepareStandalone } from "./prepare-standalone.mjs";
import {
  fingerprintBuildSource,
  invalidateVerificationBuild,
  recordVerificationBuild,
  verifyVerificationBuild,
} from "./verification-build.mjs";

const environment = () => ({
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: "43102",
  API_BASE_URL: "http://127.0.0.1:43101",
  WEBSITE_URL: "http://127.0.0.1:43102",
  WEBSITE_INDEXING_ENABLED: "false",
  KERNEL_SYNTHETIC_ENV: "1",
  WEBSITE_CSP_MODE: "enforce",
});

async function fixture(context, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "website-verification-build-"));
  context.after(async () => {
    assert.equal(path.dirname(await realpath(root)), parent);
    assert.ok(path.basename(root).startsWith("website-verification-build-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (relative, value) => {
    const filename = path.join(root, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(
      filename,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  const policy = {
    schemaVersion: 1,
    applicationReady: ready,
    allowedFiles: [
      "src/example.ts",
      "public/logo.txt",
      "package-lock.json",
      "package.json",
      ".nvmrc",
      ".env.example",
      "deploy/docker/compose.env.example",
      "deploy/native/nginx.env.example",
      "deploy/native/website.env.example",
    ],
  };
  await Promise.all([
    put(".github/bootstrap-policy.json", policy),
    put("src/example.ts", "export const value = 1;\n"),
    put("public/logo.txt", "logo"),
    put(".nvmrc", process.version.slice(1)),
    put("package.json", {
      name: "kernel-website",
      dependencies: { next: "16.4.3" },
    }),
    put("package-lock.json", {
      lockfileVersion: 3,
      packages: {
        "": { name: "kernel-website", dependencies: { next: "16.4.3" } },
        "node_modules/next": { version: "16.4.3" },
      },
    }),
    put("node_modules/next/package.json", { name: "next", version: "16.4.3" }),
    put(".next/BUILD_ID", "synthetic-build"),
    put(".next/standalone/server.js", "// Owned fixture; never executed."),
    put(".next/static/chunk.js", "synthetic chunk"),
  ]);
  return { root, put, policy, options: { environment: environment() } };
}

test("verified prepared output reuses across reviewed CSP modes and ignores only mutable Next caches", async (context) => {
  const { root, put, options } = await fixture(context);
  await prepareStandalone(root);
  const source = await fingerprintBuildSource(root);
  assert.equal(source.sourceInputs.length, 6);
  assert.ok(
    !source.sourceInputs.some((filename) => filename.endsWith("env.example")),
  );
  const record = await recordVerificationBuild(root, { ...options, source });
  assert.ok(
    record.files.some(
      ({ path }) => path === ".next/standalone/public/logo.txt",
    ),
  );
  await prepareStandalone(root);
  await put(".next/cache/changed", "mutable cache");
  await put(".next/standalone/.next/cache/changed", "mutable runtime cache");
  for (const mode of [undefined, "enforce", "report-only"]) {
    assert.deepEqual(
      await verifyVerificationBuild(root, {
        environment: {
          ...environment(),
          WEBSITE_CSP_MODE: mode,
          CI: "1",
          WEBSITE_SKIP_BUILD: "1",
        },
      }),
      record,
    );
  }
  assert.equal(record.toolchain.node, process.version);
  assert.equal(record.toolchain.platform, process.platform);
  assert.ok(!record.files.some(({ path }) => path.includes("/cache/")));
});

test("standalone route-cache writes reuse the proof while neighboring code, static bytes and cache links stay guarded", async (context) => {
  const { root, put, options } = await fixture(context);
  const cache = ".next/standalone/.next/server/route-cache";
  const server = ".next/standalone/.next/server/app/page.js";
  await put(server, "immutable server code");
  const record = await recordVerificationBuild(root, options);
  const icon = `${cache}/APP_ROUTE/46324d98b8e71cdc62410a339bc8cac206ca0a652c8fd0a60955b78d02081b73/$/icon.svg`;
  await put(`${icon}.body`, "runtime icon body");
  await put(`${icon}.meta`, { headers: { "content-type": "image/svg+xml" } });
  assert.deepEqual(await verifyVerificationBuild(root, options), record);

  await put(server, "changed server code");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
  await put(server, "immutable server code");
  await put(".next/static/chunk.js", "changed static bytes");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
  await put(".next/static/chunk.js", "synthetic chunk");
  const rootCache = ".next/server/route-cache/route.body";
  await put(rootCache, "unapproved root cache exception");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
  await rm(path.join(root, rootCache));
  assert.deepEqual(await verifyVerificationBuild(root, options), record);

  const cacheDirectory = path.join(root, cache);
  assert.ok(path.relative(root, cacheDirectory).startsWith(`.next${path.sep}`));
  await rm(cacheDirectory, { recursive: true });
  const target = path.join(root, "coverage/owned-empty-cache");
  await mkdir(target);
  await symlink(
    target,
    cacheDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(verifyVerificationBuild(root, options), /links/);
  assert.deepEqual(await readdir(target), []);
});

test("source, semantic environment, pinned runtime and installed Next changes invalidate reuse", async (context) => {
  const { root, put, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  for (const change of [
    { API_BASE_URL: "http://127.0.0.1:43103" },
    { PORT: "43104", WEBSITE_URL: "http://127.0.0.1:43104" },
    { KERNEL_SYNTHETIC_ENV: "true" },
    { WEBSITE_CSP_MODE: "disabled" },
    { WEBSITE_INDEXING_ENABLED: "true" },
    { NODE_ENV: "development" },
  ])
    await assert.rejects(
      verifyVerificationBuild(root, {
        environment: { ...environment(), ...change },
      }),
    );
  await put("node_modules/next/package.json", {
    name: "next",
    version: "16.4.4",
  });
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /installed Next/,
  );
  await put("node_modules/next/package.json", {
    name: "next",
    version: "16.4.3",
  });
  await put(".nvmrc", "24.0.0");
  await assert.rejects(verifyVerificationBuild(root, options), /pinned Node/);
  await put(".nvmrc", process.version.slice(1));
  await put("src/example.ts", "export const value = 2;\n");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
});

test("changed, missing and extra output files fail and prebuild invalidation removes the old proof", async (context) => {
  const { root, put, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  await put(".next/static/chunk.js", "changed");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
  await put(".next/static/chunk.js", "synthetic chunk");
  await put(".next/extra.json", "{}");
  await assert.rejects(
    verifyVerificationBuild(root, options),
    /does not match/,
  );
  await rm(path.join(root, ".next/extra.json"));
  await rm(path.join(root, ".next/BUILD_ID"));
  await assert.rejects(verifyVerificationBuild(root, options), /BUILD_ID/);
  await invalidateVerificationBuild(root);
  await invalidateVerificationBuild(root);
  await assert.rejects(
    lstat(path.join(root, "coverage/verification-build.json")),
    /ENOENT/,
  );
});

test("readiness precedes options and private source paths are rejected before reading", async (context) => {
  const { root, put, policy } = await fixture(context, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("operation input was read");
      },
    },
  );
  for (const operation of [recordVerificationBuild, verifyVerificationBuild])
    await assert.rejects(operation(root, poison), /non-runnable/);
  await assert.rejects(fingerprintBuildSource(root), /non-runnable/);
  await assert.rejects(fingerprintBuildSource(root, poison), /non-runnable/);
  await assert.rejects(invalidateVerificationBuild(root), /non-runnable/);
  policy.applicationReady = true;
  for (const filename of [
    ".env.local",
    "../private.ts",
    "node_modules/private.json",
    "src/private.key",
  ]) {
    await put(".github/bootstrap-policy.json", {
      ...policy,
      allowedFiles: [...policy.allowedFiles, filename],
    });
    await assert.rejects(fingerprintBuildSource(root), /Private|safe relative/);
  }
});

test("unadmitted public inputs and private names fail before their contents are opened", async (context) => {
  const { root, put } = await fixture(context);
  const original = fsPromises.open;
  const opened = [];
  const reader = context.mock.method(fsPromises, "open", (...args) => {
    opened.push(args[0]);
    return original(...args);
  });
  syncBuiltinESMExports();
  try {
    for (const relative of [
      "src/app/probe/page.tsx",
      "public/unadmitted.txt",
      "next.config.ts",
      "src/.next/not-a-cache.ts",
      "src/private.key",
    ]) {
      await put(relative, "unadmitted input must never be read");
      opened.length = 0;
      await assert.rejects(
        fingerprintBuildSource(root),
        /Unadmitted verification source|Private or generated/,
      );
      assert.equal(opened.includes(path.join(root, relative)), false);
      await rm(path.join(root, relative));
      if (relative === "src/app/probe/page.tsx") {
        await fsPromises.rmdir(path.join(root, "src/app/probe"));
        await fsPromises.rmdir(path.join(root, "src/app"));
      }
      if (relative === "src/.next/not-a-cache.ts")
        await fsPromises.rmdir(path.join(root, "src/.next"));
    }
  } finally {
    reader.mock.restore();
    syncBuiltinESMExports();
  }
});

test("verification validates cancellation after readiness and preserves a pre-aborted reason", async (context) => {
  const { root, options } = await fixture(context);
  const controller = new AbortController();
  const reason = new Error("synthetic pre-aborted verification");
  controller.abort(reason);
  for (const operation of [fingerprintBuildSource, recordVerificationBuild]) {
    await assert.rejects(
      operation(root, { ...options, signal: {} }),
      /AbortSignal/,
    );
    await assert.rejects(
      operation(root, { ...options, signal: controller.signal }),
      (error) => error === reason,
    );
  }
});

test("cancelling a bounded read closes the input handle and preserves the cancellation reason", async (context) => {
  const { root } = await fixture(context);
  const controller = new AbortController();
  const reason = new Error("synthetic bounded-read cancellation");
  const probe = await open(path.join(root, ".next/BUILD_ID"), "r");
  const prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const original = prototype.readFile;
  const reader = context.mock.method(
    prototype,
    "readFile",
    function (settings) {
      controller.abort(reason);
      return original.call(this, settings);
    },
  );
  try {
    await assert.rejects(
      fingerprintBuildSource(root, { signal: controller.signal }),
      (error) => error === reason,
    );
    assert.equal(reader.mock.calls[0].this.fd, -1);
  } finally {
    reader.mock.restore();
  }
});

test("cancellation drains every started hash and closes its handles before rejecting with the original reason", async (context) => {
  const { root, options } = await fixture(context);
  for (const operation of [fingerprintBuildSource, recordVerificationBuild]) {
    await recordVerificationBuild(root, options);
    const controller = new AbortController();
    const reason = new Error("synthetic hashing cancellation");
    const probe = await open(path.join(root, ".next/BUILD_ID"), "r");
    const prototype = Object.getPrototypeOf(probe);
    await probe.close();
    const original = prototype.createReadStream;
    const handles = [];
    const streams = [];
    const reader = context.mock.method(
      prototype,
      "createReadStream",
      function (settings) {
        const stream = original.call(this, settings);
        handles.push(this);
        streams.push(stream);
        if (streams.length === 1)
          stream.once("data", () => controller.abort(reason));
        return stream;
      },
    );
    try {
      await assert.rejects(
        operation(root, { ...options, signal: controller.signal }),
        (error) => error === reason,
      );
      assert.ok(streams.length > 0);
      assert.ok(streams.every((stream) => stream.destroyed));
      assert.ok(handles.every((handle) => handle.fd === -1));
    } finally {
      reader.mock.restore();
    }
    if (operation === recordVerificationBuild)
      await assert.rejects(
        lstat(path.join(root, "coverage/verification-build.json")),
        /ENOENT/,
      );
  }
});

test("publication cancellation waits for the owned write and removes both prior and staged proofs", async (context) => {
  const { root, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  const controller = new AbortController();
  const reason = new Error("synthetic publication cancellation");
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  const probe = await open(path.join(root, ".next/BUILD_ID"), "r");
  const prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const original = prototype.writeFile;
  const writer = context.mock.method(
    prototype,
    "writeFile",
    async function (...args) {
      await original.apply(this, args);
      started.resolve();
      await release.promise;
    },
  );
  const settled = recordVerificationBuild(root, {
    ...options,
    signal: controller.signal,
  }).then(
    () => undefined,
    (error) => error,
  );
  try {
    assert.equal(
      await Promise.race([
        started.promise.then(() => "writing"),
        settled.then(() => "settled"),
      ]),
      "writing",
    );
    controller.abort(reason);
    release.resolve();
    assert.equal(await settled, reason);
    assert.equal(writer.mock.calls[0].this.fd, -1);
    assert.deepEqual(await readdir(path.join(root, "coverage")), []);
  } finally {
    release.resolve();
    await settled;
    writer.mock.restore();
  }
});

test("an abort after rename removes the published proof and retains cleanup failures", async (context) => {
  const { root, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  const controller = new AbortController();
  const reason = new Error("synthetic post-rename cancellation");
  const cleanup = new Error("synthetic cancelled-stage cleanup failure");
  const rename = fsPromises.rename;
  const removeParent = fsPromises.rmdir;
  let stage;
  const publisher = context.mock.method(
    fsPromises,
    "rename",
    async (...args) => {
      stage = path.dirname(args[0]);
      await rename(...args);
      controller.abort(reason);
    },
  );
  const parent = context.mock.method(fsPromises, "rmdir", async (filename) => {
    assert.equal(filename, stage);
    await removeParent(filename);
    throw cleanup;
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(
      recordVerificationBuild(root, { ...options, signal: controller.signal }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.cause, reason);
        assert.deepEqual(error.errors, [reason, cleanup]);
        return true;
      },
    );
    assert.deepEqual(await readdir(path.join(root, "coverage")), []);
  } finally {
    publisher.mock.restore();
    parent.mock.restore();
    syncBuiltinESMExports();
  }
});

test("linked output and prior-record paths fail without touching linked targets", async (context) => {
  const { root, put, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  const target = path.join(root, "coverage/owned-empty");
  await mkdir(target);
  await symlink(
    target,
    path.join(root, ".next/linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(verifyVerificationBuild(root, options), /links/);
  await rm(path.join(root, ".next/linked"), { recursive: true });
  await rm(path.join(root, "coverage/verification-build.json"));
  await symlink(
    target,
    path.join(root, "coverage/verification-build.json"),
    process.platform === "win32" ? "junction" : "dir",
  );
  for (const operation of [
    recordVerificationBuild,
    verifyVerificationBuild,
    invalidateVerificationBuild,
  ])
    await assert.rejects(operation(root, options), /regular file/);
  assert.deepEqual(await readdir(target), []);
  await put(".next/cache/not-read", "cache");
});

test("source drift before or during output hashing cannot publish a build record", async (context) => {
  const { root, put, options } = await fixture(context);
  const source = await fingerprintBuildSource(root);
  await put("src/example.ts", "changed before build finished");
  await assert.rejects(
    recordVerificationBuild(root, { ...options, source }),
    /Source changed/,
  );
  await put("src/example.ts", "export const value = 1;\n");
  const probe = await open(path.join(root, ".next/BUILD_ID"), "r");
  const prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const original = prototype.createReadStream;
  let reads = 0;
  const reader = context.mock.method(
    prototype,
    "createReadStream",
    function (settings) {
      const stream = original.call(this, settings);
      if (++reads === source.sourceInputs.length + 1)
        stream.once("data", () =>
          writeFileSync(
            path.join(root, "src/example.ts"),
            "changed during output hashing",
          ),
        );
      return stream;
    },
  );
  await assert.rejects(
    recordVerificationBuild(root, { ...options, source }),
    /Source changed/,
  );
  reader.mock.restore();
  await assert.rejects(
    lstat(path.join(root, "coverage/verification-build.json")),
    /ENOENT/,
  );
});

test("a partial proof write closes its handle and preserves the previous record", async (context) => {
  const { root, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  const filename = path.join(root, "coverage/verification-build.json");
  const previous = await readFile(filename);
  const probe = await open(path.join(root, ".next/BUILD_ID"), "r");
  const prototype = Object.getPrototypeOf(probe);
  await probe.close();
  const write = prototype.writeFile;
  const failure = new Error("synthetic proof write failure");
  const writer = context.mock.method(
    prototype,
    "writeFile",
    async function (content, encoding) {
      await write.call(this, content.slice(0, 8), encoding);
      throw failure;
    },
  );
  await assert.rejects(
    recordVerificationBuild(root, options),
    (error) => error === failure,
  );
  writer.mock.restore();
  assert.equal(writer.mock.calls[0].this.fd, -1);
  assert.deepEqual(await readFile(filename), previous);
  assert.deepEqual(await readdir(path.join(root, "coverage")), [
    "verification-build.json",
  ]);
});

test("failed publication drains file cleanup before attempting its parent and preserves every failure", async (context) => {
  const { root, options } = await fixture(context);
  await recordVerificationBuild(root, options);
  const coverage = path.join(root, "coverage");
  const filename = path.join(coverage, "verification-build.json");
  const previous = await readFile(filename);
  const publicationFailure = new Error("synthetic publication failure");
  const fileFailure = new Error("synthetic file cleanup failure");
  const parentFailure = new Error("synthetic parent cleanup failure");
  const fileStarted = Promise.withResolvers();
  const releaseFile = Promise.withResolvers();
  const calls = [];
  let stage;
  const publish = context.mock.method(
    fsPromises,
    "rename",
    async (source, target) => {
      stage = path.dirname(source);
      assert.equal(path.dirname(stage), coverage);
      assert.match(path.basename(stage), /^\.verification-build-/);
      assert.equal(path.basename(source), "record.json");
      assert.equal(target, filename);
      throw publicationFailure;
    },
  );
  const removeFile = context.mock.method(
    fsPromises,
    "rm",
    async (target, settings) => {
      assert.equal(target, path.join(stage, "record.json"));
      assert.deepEqual(settings, { force: true });
      calls.push("file");
      fileStarted.resolve();
      await releaseFile.promise;
      calls.push("file rejected");
      throw fileFailure;
    },
  );
  const removeParent = context.mock.method(
    fsPromises,
    "rmdir",
    async (target) => {
      assert.equal(target, stage);
      calls.push("parent");
      throw parentFailure;
    },
  );
  syncBuiltinESMExports();
  const settled = recordVerificationBuild(root, options).then(
    () => undefined,
    (error) => error,
  );
  try {
    const first = await Promise.race([
      fileStarted.promise.then(() => "file cleanup"),
      settled.then(() => "operation settled"),
    ]);
    assert.equal(first, "file cleanup");
    assert.deepEqual(calls, ["file"]);
    assert.equal((await lstat(path.join(stage, "record.json"))).isFile(), true);
    assert.deepEqual(await readFile(filename), previous);
    releaseFile.resolve();
    const failure = await settled;
    assert.ok(failure instanceof AggregateError);
    assert.equal(failure.cause, publicationFailure);
    assert.equal(failure.errors.length, 3);
    for (const [index, expected] of [
      publicationFailure,
      fileFailure,
      parentFailure,
    ].entries())
      assert.equal(failure.errors[index], expected);
    assert.deepEqual(calls, ["file", "file rejected", "parent"]);
    assert.deepEqual(await readFile(filename), previous);
  } finally {
    releaseFile.resolve();
    await settled;
    publish.mock.restore();
    removeFile.mock.restore();
    removeParent.mock.restore();
    syncBuiltinESMExports();
  }
});
