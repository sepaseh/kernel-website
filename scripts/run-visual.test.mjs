import assert from "node:assert/strict";
import { ChildProcess, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import { createPlaywrightConfig } from "./playwright-config.mjs";
import { runVisual } from "./run-visual.mjs";
import {
  abortOnFixtureFile,
  controlledStopTimers,
} from "./runner.test-support.mjs";
import { recordVerificationBuild } from "./verification-build.mjs";
import { acquireVisualLock } from "./visual-environment.mjs";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-visual-wrapper-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-visual-wrapper-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (name, value) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: ready,
    allowedFiles: [
      ".nvmrc",
      "package.json",
      "package-lock.json",
      "public/logo.svg",
      "playwright.visual.config.ts",
      "e2e/visual/website.spec.ts",
      "e2e/visual/readiness.ts",
      `e2e/visual/baselines/${process.platform}/metadata.json`,
      "src/app/globals.css",
      "src/features/home/Home.tsx",
      "src/app/_components/Header.tsx",
      "src/features/auth/login/Login.tsx",
      "src/features/auth/register/Register.tsx",
      "src/shared/fonts/manifest.json",
      "src/shared/fonts/vazirmatn.css",
      "scripts/website-api-fixture.mjs",
    ],
  });
  await put(".nvmrc", process.version.slice(1));
  await put("package.json", {
    name: "kernel-website",
    type: "module",
    devDependencies: { "@playwright/test": "1.64.1" },
  });
  await put("package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": {
        name: "kernel-website",
        devDependencies: { "@playwright/test": "1.64.1" },
      },
      "node_modules/@playwright/test": {
        version: "1.64.1",
        dependencies: { playwright: "1.64.1" },
      },
      "node_modules/playwright": {
        version: "1.64.1",
        dependencies: { "playwright-core": "1.64.1" },
      },
      "node_modules/playwright-core": { version: "1.64.1" },
    },
  });
  await put("node_modules/@playwright/test/package.json", {
    name: "@playwright/test",
    version: "1.64.1",
    type: "module",
    bin: { playwright: "cli.js" },
    dependencies: { playwright: "1.64.1" },
  });
  await put("node_modules/playwright/package.json", {
    name: "playwright",
    version: "1.64.1",
    dependencies: { "playwright-core": "1.64.1" },
    exports: {
      "./package.json": "./package.json",
      "./lib/program": "./lib/program.js",
      "./test": { import: "./test.mjs", require: "./test.js" },
    },
  });
  await put("node_modules/playwright-core/package.json", {
    name: "playwright-core",
    version: "1.64.1",
    exports: {
      "./package.json": "./package.json",
      ".": { import: "./index.mjs", require: "./index.js" },
    },
  });
  for (const name of [
    "playwright/lib/program.js",
    "playwright/test.js",
    "playwright/test.mjs",
    "playwright-core/index.js",
    "playwright-core/index.mjs",
  ])
    await put(`node_modules/${name}`, "// Inert synthetic transitive entry.\n");
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{writeFileSync}from'node:fs';writeFileSync('capture.json',JSON.stringify({args:process.argv.slice(2),environment:process.env}));`,
  );
  await put(
    "node_modules/@playwright/test/index.mjs",
    `import{writeFileSync}from'node:fs';export const chromium={async launch(options){writeFileSync('probe.json',JSON.stringify(options));return {version(){return 'synthetic-chromium';},async close(){writeFileSync('probe-closed','closed');}};}};`,
  );
  await put("playwright.visual.config.ts", "// Owned fake visual config.\n");
  for (const name of [
    "e2e/visual/website.spec.ts",
    "e2e/visual/readiness.ts",
    "src/app/globals.css",
    "src/features/home/Home.tsx",
    "src/app/_components/Header.tsx",
    "src/features/auth/login/Login.tsx",
    "src/features/auth/register/Register.tsx",
    "src/shared/fonts/manifest.json",
    "src/shared/fonts/vazirmatn.css",
  ])
    await put(name, "// Owned synthetic source for explicit fingerprinting.\n");
  await createApiFixture(put);
  const apiPort = await unusedPort();
  let websitePort = await unusedPort();
  while (websitePort === apiPort) websitePort = await unusedPort();
  const environment = {
    NODE_ENV: "production",
    API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    HOSTNAME: "127.0.0.1",
    PORT: String(websitePort),
    WEBSITE_URL: `http://127.0.0.1:${websitePort}`,
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",

    NODE_OPTIONS: "--invalid-option",
    TOKEN: "synthetic-disallowed",
  };
  const metadataPath = `e2e/visual/baselines/${process.platform}/metadata.json`;
  const reviewed = {
    platform: process.platform,
    playwright: "1.64.1",
    browserVersion: "synthetic-chromium",
    sourceFingerprint: "earlier-source-before-legitimate-change",
    review: {
      status: "reviewed",
      reviewer: "Synthetic reviewer",
      reviewedAt: "2026-01-15T12:00:00Z",
    },
  };
  await put(metadataPath, reviewed);
  const prepareBuild = async () => {
    const manifest = await json(root, "package.json");
    manifest.dependencies = { next: "16.4.3" };
    await put("package.json", manifest);
    const lock = await json(root, "package-lock.json");
    lock.packages[""].dependencies = manifest.dependencies;
    lock.packages["node_modules/next"] = { version: "16.4.3" };
    await put("package-lock.json", lock);
    await put("node_modules/next/package.json", {
      name: "next",
      version: "16.4.3",
    });
    await put("public/logo.svg", "owned public source");
    await put(".next/BUILD_ID", "owned-build");
    await put(".next/static/chunk.js", "owned static output");
    await put(".next/standalone/server.js", "// Owned prepared server.\n");
    await recordVerificationBuild(root, { environment });
  };
  return { root, put, environment, metadataPath, reviewed, prepareBuild };
}

const json = async (root, name) =>
  JSON.parse(await readFile(path.join(root, name), "utf8"));
async function noFile(root, name) {
  await assert.rejects(readFile(path.join(root, name)), /ENOENT/);
}
async function lockReleased(root) {
  await noFile(root, "test-results/.visual-run.lock");
}

test("visual readiness and pre-abort precede options, public environment and artifacts", async (t) => {
  const { root } = await fixture(t, false);
  await assert.rejects(
    runVisual(
      root,
      new Proxy(
        {},
        {
          get() {
            throw Error("options read");
          },
        },
      ),
    ),
    /applicationReady:true/,
  );
  const ready = await fixture(t);
  await assert.rejects(
    runVisual(ready.root, {
      signal: AbortSignal.abort(),
      get environment() {
        throw Error("environment read");
      },
    }),
    /aborted/,
  );
  await assert.rejects(runVisual(ready.root, { signal: {} }), /AbortSignal/);
  await noFile(ready.root, "probe.json");
  await noFile(ready.root, "capture.json");
});

test("visual arguments and every nonempty CI update marker fail before SDK or baseline access", async (t) => {
  const { root, environment } = await fixture(t);
  for (const argv of [
    ["--foreign"],
    ["--update", "--update"],
    "--update",
    new Array(1),
  ])
    await assert.rejects(
      runVisual(root, { environment, argv }),
      /one optional --update/,
    );
  await rm(path.join(root, "node_modules/@playwright/test/package.json"));
  for (const CI of ["1", "true", "false"])
    await assert.rejects(
      runVisual(root, {
        argv: ["--update"],
        environment: { ...environment, CI },
      }),
      /forbidden in CI/,
    );
  await noFile(root, "probe.json");
});

test("comparison uses actual host metadata, verified SDK and public explicit origins with the real owned fake CLI", async (t) => {
  const { root, put, environment, metadataPath, reviewed } = await fixture(t);
  const result = await runVisual(root, {
    environment,
    get platform() {
      throw Error("platform override must never be read");
    },
  });
  assert.equal(result.mode, "compare");
  assert.equal(result.metadataPath, path.join(root, metadataPath));
  const capture = await json(root, "capture.json");
  assert.deepEqual(capture.args, [
    "test",
    `--config=${path.join(root, "playwright.visual.config.ts")}`,
  ]);
  for (const [key, value] of Object.entries({
    API_BASE_URL: environment.API_BASE_URL,
    WEBSITE_URL: environment.WEBSITE_URL,

    KERNEL_VISUAL_RUNNER: "1",
    WEBSITE_SKIP_BUILD: "0",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  }))
    assert.equal(capture.environment[key], value);
  for (const key of ["NODE_OPTIONS", "TOKEN"])
    assert.equal(Object.hasOwn(capture.environment, key), false);
  assert.equal(
    await readFile(path.join(root, "probe-closed"), "utf8"),
    "closed",
  );
  assert.deepEqual(await json(root, metadataPath), reviewed);
  const report = await json(root, "test-results/visual/environment.json");
  assert.equal(report.platform, process.platform);
  assert.equal(report.browserVersion, "synthetic-chromium");
  assert.equal(report.mode, "compare");
  assert.equal(report.outcome, "passed");
  assert.equal(report.exitCode, 0);
  // Reference digests include the declared filenames and the fixture's exact
  // known bytes in source order, independently of asynchronous read completion.
  assert.equal(
    report.sourceFingerprint,
    "f49afa8eb0688b73c150dff784191edf8bd69ed5fb4373d621ec902b0a604473",
  );
  await put("src/features/home/Home.tsx", "// Changed owned source bytes.\n");
  await runVisual(root, { environment });
  assert.equal(
    (await json(root, "test-results/visual/environment.json"))
      .sourceFingerprint,
    "33d590bcee7ea43639e8852da6e118d309ab1274bcdc7156fee658b0d8034640",
  );
  assert.deepEqual(await json(root, metadataPath), reviewed);
  await lockReleased(root);
});

test("comparison refuses missing or unreviewed metadata and mismatched browser without capture", async (t) => {
  const { root, put, environment, metadataPath, reviewed } = await fixture(t);
  await rm(path.join(root, metadataPath));
  await assert.rejects(runVisual(root, { environment }), /ENOENT/);
  await put(metadataPath, {
    ...reviewed,
    review: { ...reviewed.review, status: "pending" },
  });
  await assert.rejects(
    runVisual(root, { environment }),
    /review metadata mismatch/,
  );
  await noFile(root, "probe.json");
  await put(metadataPath, { ...reviewed, browserVersion: "foreign-browser" });
  await assert.rejects(
    runVisual(root, { environment }),
    /Chromium does not match/,
  );
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test("verified visual reuse preserves build bytes and uses skip-build without updating baselines", async (t) => {
  const { root, environment, metadataPath, reviewed, prepareBuild } =
    await fixture(t);
  await prepareBuild();
  const record = await readFile(
    path.join(root, "coverage/verification-build.json"),
  );
  await runVisual(root, { environment, reuseBuild: true });
  assert.equal(
    (await json(root, "capture.json")).environment.WEBSITE_SKIP_BUILD,
    "1",
  );
  assert.deepEqual(
    await readFile(path.join(root, "coverage/verification-build.json")),
    record,
  );
  assert.deepEqual(await json(root, metadataPath), reviewed);
  await lockReleased(root);
});

test("visual reuse refuses invalid switches, updates and unverified output before probing", async (t) => {
  const { root, put, environment, prepareBuild } = await fixture(t);
  for (const reuseBuild of [null, "1", 1])
    await assert.rejects(
      runVisual(root, { environment, reuseBuild }),
      /explicit boolean/,
    );
  await assert.rejects(
    runVisual(root, { environment, reuseBuild: true, argv: ["--update"] }),
    /fresh owned build/,
  );
  await assert.rejects(runVisual(root, { environment, reuseBuild: true }));
  await noFile(root, "probe.json");
  await prepareBuild();
  await put(".next/static/chunk.js", "tampered output");
  await assert.rejects(runVisual(root, { environment, reuseBuild: true }));
  await noFile(root, "probe.json");
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test("failed actual snapshot update invalidates review before any synthetic image replacement", async (t) => {
  const { root, put, environment, metadataPath } = await fixture(t);
  await put("synthetic.png", "previous synthetic pixels");
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{readFileSync,writeFileSync}from'node:fs';const metadata=JSON.parse(readFileSync(${JSON.stringify(metadataPath)},'utf8'));writeFileSync('capture-review.json',JSON.stringify(metadata.review));writeFileSync('synthetic.png','new unreviewed synthetic pixels');process.exitCode=7;`,
  );
  await assert.rejects(
    runVisual(root, { environment, argv: ["--update"] }),
    /code 7/,
  );
  assert.deepEqual(await json(root, "capture-review.json"), {
    status: "pending",
    reviewer: null,
    reviewedAt: null,
  });
  assert.deepEqual((await json(root, metadataPath)).review, {
    status: "pending",
    reviewer: null,
    reviewedAt: null,
  });
  assert.equal(
    await readFile(path.join(root, "synthetic.png"), "utf8"),
    "new unreviewed synthetic pixels",
  );
  assert.equal(
    (await json(root, "test-results/visual/environment.json")).outcome,
    "failed",
  );
  await lockReleased(root);
});

test("metadata write failure prevents actual capture and releases only the owned run lock", async (t) => {
  const { root, environment, metadataPath } = await fixture(t);
  await rm(path.join(root, metadataPath));
  await mkdir(path.join(root, metadataPath));
  await assert.rejects(
    runVisual(root, { environment, argv: ["--update"] }),
    /unlinked regular file/,
  );
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test("an existing Next lock and another visual owner block probing without removing their locks", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put(".next/lock", "existing owner's lock");
  await assert.rejects(
    runVisual(root, { environment }),
    /Another Next process/,
  );
  assert.equal(
    await readFile(path.join(root, ".next/lock"), "utf8"),
    "existing owner's lock",
  );
  await noFile(root, "probe.json");
  await lockReleased(root);
  await rm(path.join(root, ".next/lock"));
  const release = await acquireVisualLock(path.join(root, "test-results"));
  try {
    await assert.rejects(
      runVisual(root, { environment }),
      /Another visual run/,
    );
  } finally {
    await release();
  }
});

test("comparison acquires exclusion before reading baseline review metadata", async (t) => {
  const { root, put, environment, metadataPath, reviewed } = await fixture(t);
  const release = await acquireVisualLock(path.join(root, "test-results"));
  await put(metadataPath, {
    ...reviewed,
    review: { ...reviewed.review, status: "pending" },
  });
  try {
    await assert.rejects(
      runVisual(root, { environment }),
      /Another visual run/,
    );
  } finally {
    await release();
  }
  await assert.rejects(
    runVisual(root, { environment }),
    /review metadata mismatch/,
  );
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test("capture output cleanup preserves exclusion until the actual capture finishes", async (t) => {
  const { root, put, environment } = await fixture(t);
  const config = await createPlaywrightConfig(root, "visual", {
    environment: { ...environment, KERNEL_VISUAL_RUNNER: "1" },
    argv: [],
  });
  assert.equal(
    path.relative(root, config.outputDir),
    path.join("test-results", "visual"),
  );
  const ready = Promise.withResolvers();
  const server = createServer((socket) => {
    socket.once("error", ready.reject);
    socket.once("data", (data) => {
      assert.equal(data.toString(), "ready");
      ready.resolve(socket);
    });
  });
  server.once("error", ready.reject);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const controller = new AbortController();
  let connection;
  let operation;
  try {
    await put(
      "node_modules/@playwright/test/cli.js",
      `import{mkdirSync,rmSync}from'node:fs';import{connect}from'node:net';rmSync(${JSON.stringify(config.outputDir)},{recursive:true,force:true});mkdirSync(${JSON.stringify(config.outputDir)},{recursive:true});const socket=connect(${server.address().port},'127.0.0.1');socket.once('connect',()=>socket.write('ready'));socket.once('data',()=>socket.end());`,
    );
    operation = runVisual(root, { environment, signal: controller.signal });
    connection = await Promise.race([
      ready.promise,
      operation.then(() => {
        throw Error("Synthetic capture finished before publishing readiness.");
      }),
    ]);
    await assert.rejects(
      acquireVisualLock(path.join(root, "test-results")),
      /Another visual run/,
    );
    connection.end("continue");
    await operation;
    await lockReleased(root);
  } finally {
    controller.abort();
    connection?.destroy();
    await operation?.catch(() => {});
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("probe validation and bounded output failures preserve baselines and release ownership", async (t) => {
  const { root, put, environment, metadataPath, reviewed } = await fixture(t);
  await put(
    "node_modules/@playwright/test/index.mjs",
    "export const chromium={async launch(){return{version(){return '';},async close(){}};}};\n",
  );
  await assert.rejects(
    runVisual(root, { environment }),
    /explicit browser version/,
  );
  await lockReleased(root);
  await put(
    "node_modules/@playwright/test/index.mjs",
    "import{createServer}from'node:net';export const chromium={async launch(){createServer().listen(0,'127.0.0.1');process.stdout.write('x'.repeat(5000));await new Promise(()=>{});}};\n",
  );
  await assert.rejects(runVisual(root, { environment }), /bounded output/);
  assert.deepEqual(await json(root, metadataPath), reviewed);
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test("probe overflow retains its read failure when direct-child stopping also fails", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put(
    "node_modules/@playwright/test/index.mjs",
    "import{createServer}from'node:net';export const chromium={async launch(){createServer().listen(0,'127.0.0.1');process.stdout.write('x'.repeat(5000));await new Promise(()=>{});}};\n",
  );
  const timers = controlledStopTimers(t);
  const stopping = Promise.withResolvers();
  const ownedChildren = [];
  const original = ChildProcess.prototype.kill;
  const replacement = t.mock.method(
    ChildProcess.prototype,
    "kill",
    function () {
      ownedChildren.push(this);
      stopping.resolve();
      throw Error("synthetic owned kill failure");
    },
  );
  try {
    const outcome = assert.rejects(
      runVisual(root, { environment }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        const messages = [];
        const inspect = (value) => {
          messages.push(value.message);
          for (const nested of value.errors ?? []) inspect(nested);
        };
        inspect(error);
        assert.ok(
          messages.some((message) => message.includes("bounded output")),
        );
        assert.ok(
          messages.some((message) => message.includes("bounded stop deadline")),
        );
        return true;
      },
    );
    await Promise.race([
      stopping.promise,
      outcome.then(() => {
        throw new Error("Visual probe finished before its owned stop failed.");
      }),
    ]);
    timers.fireNext();
    timers.fireNext();
    await outcome;
    assert.equal(timers.pendingCount, 0);
  } finally {
    replacement.mock.restore();
    const ownedChild = ownedChildren[0];
    if (
      ownedChild &&
      ownedChild.exitCode === null &&
      ownedChild.signalCode === null
    ) {
      const closed = once(ownedChild, "close");
      original.call(ownedChild, "SIGKILL");
      await closed;
    }
  }
  assert.equal(
    await readFile(path.join(root, "test-results/.visual-run.lock"), "utf8"),
    `${process.pid}\n`,
  );
  await assert.rejects(
    acquireVisualLock(path.join(root, "test-results")),
    /Another visual run/,
  );
});

test("capture failure and report failure are both preserved", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put("node_modules/@playwright/test/cli.js", "process.exitCode=7;\n");
  await mkdir(path.join(root, "test-results/visual/environment.json"), {
    recursive: true,
  });
  await assert.rejects(runVisual(root, { environment }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /code 7/);
    assert.match(error.errors[1].message, /unlinked regular file/);
    return true;
  });
  await lockReleased(root);
});

test("a capture stop deadline keeps exclusion across retries with different ports", async (t) => {
  const { root, put, environment, metadataPath } = await fixture(t);
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{createServer}from'node:net';import{renameSync,writeFileSync}from'node:fs';createServer().listen(0,'127.0.0.1');writeFileSync('capture-started.tmp','ready');renameSync('capture-started.tmp','capture-started');`,
  );
  const controller = new AbortController();
  const timers = controlledStopTimers(t);
  const stopping = Promise.withResolvers();
  const original = ChildProcess.prototype.kill;
  const ownedChildren = [];
  const replacement = t.mock.method(
    ChildProcess.prototype,
    "kill",
    function () {
      ownedChildren.push(this);
      stopping.resolve();
      throw Error("synthetic capture kill failure");
    },
  );
  try {
    const outcome = assert.rejects(
      abortOnFixtureFile(root, "capture-started", controller, () =>
        runVisual(root, {
          environment,
          argv: ["--update"],
          signal: controller.signal,
        }),
      ),
      /bounded stop deadline/,
    );
    await Promise.race([
      stopping.promise,
      outcome.then(() => {
        throw Error("Capture finished before its synthetic stop failure.");
      }),
    ]);
    timers.fireNext();
    timers.fireNext();
    await outcome;
    assert.equal(timers.pendingCount, 0);
    assert.equal((await json(root, metadataPath)).review.status, "pending");
    const websitePort = await unusedPort();
    await assert.rejects(
      runVisual(root, {
        environment: {
          ...environment,
          PORT: String(websitePort),
          WEBSITE_URL: `http://127.0.0.1:${websitePort}`,
        },
        argv: ["--update"],
      }),
      /Another visual run/,
    );
  } finally {
    replacement.mock.restore();
    const ownedChild = ownedChildren[0];
    if (
      ownedChild &&
      ownedChild.exitCode === null &&
      ownedChild.signalCode === null
    ) {
      const closed = once(ownedChild, "close");
      original.call(ownedChild, "SIGKILL");
      await closed;
    }
  }
  assert.equal(
    await readFile(path.join(root, "test-results/.visual-run.lock"), "utf8"),
    `${process.pid}\n`,
  );
});

test("capture failure and replaced-lock cleanup failure remain visible while replacement survives", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{renameSync,writeFileSync}from'node:fs';renameSync('test-results/.visual-run.lock','test-results/old-owned-lock');writeFileSync('test-results/.visual-run.lock','replacement');process.exitCode=7;`,
  );
  await assert.rejects(runVisual(root, { environment }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /code 7/);
    assert.match(error.errors[1].message, /ownership changed/);
    return true;
  });
  assert.equal(
    await readFile(path.join(root, "test-results/.visual-run.lock"), "utf8"),
    "replacement",
  );
});

test("aborting an actual owned capture preserves pending review and drains its process", async (t) => {
  const { root, put, environment, metadataPath } = await fixture(t);
  // Publish the complete marker before the watcher can stop its writer.
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{createServer}from'node:net';import{renameSync,writeFileSync}from'node:fs';createServer().listen(0,'127.0.0.1');writeFileSync('capture-started.tmp','ready');renameSync('capture-started.tmp','capture-started');`,
  );
  const controller = new AbortController();
  await assert.rejects(
    abortOnFixtureFile(root, "capture-started", controller, () =>
      runVisual(root, {
        environment,
        argv: ["--update"],
        signal: controller.signal,
      }),
    ),
    /aborted/,
  );
  assert.equal(
    await readFile(path.join(root, "capture-started"), "utf8"),
    "ready",
  );
  assert.equal((await json(root, metadataPath)).review.status, "pending");
  await lockReleased(root);
});

test("visual runner imports stay inert and its actual CLI refuses absent public inputs", async () => {
  const marker = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const target = new URL("run-visual.mjs", import.meta.url);
  const importing = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const before=process.listenerCount('SIGTERM');await import(${JSON.stringify(target.href)});if(before!==process.listenerCount('SIGTERM'))throw Error('listener changed');console.log('inert');`,
    ],
    { encoding: "utf8", env: {}, windowsHide: true },
  );
  assert.ifError(importing.error);
  assert.equal(importing.status, 0, importing.stderr);
  assert.equal(importing.stdout.trim(), "inert");
  const executing = spawnSync(process.execPath, [fileURLToPath(target)], {
    encoding: "utf8",
    env: {},
    windowsHide: true,
  });
  assert.ifError(executing.error);
  assert.equal(executing.status, 1);
  assert.match(
    executing.stderr,
    marker.applicationReady ? /KERNEL_SYNTHETIC_ENV/ : /applicationReady:true/,
  );
});
