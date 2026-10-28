import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { watch } from "node:fs";
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

import { runVisual } from "./run-visual.mjs";
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
  });
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
      "node_modules/@playwright/test": { version: "1.64.1" },
    },
  });
  await put("node_modules/@playwright/test/package.json", {
    name: "@playwright/test",
    version: "1.64.1",
    type: "module",
    bin: { playwright: "cli.js" },
  });
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
    "src/website/home/Home.tsx",
    "src/website/layouts/Header.tsx",
    "src/features/login/Login.tsx",
    "src/features/register/Register.tsx",
    "src/shared/fonts/manifest.json",
    "src/shared/fonts/vazirmatn.css",
  ])
    await put(name, "// Owned synthetic source for explicit fingerprinting.\n");
  await put("api-fixture/package.json", { name: "kernel-api" });
  await put("api-fixture/src/index.ts", "// Owned structural marker.\n");
  await put(
    "api-fixture/scripts/test-website-api.mjs",
    "// Owned fake API entry; not executed.\n",
  );
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
    KERNEL_API_DIRECTORY: path.join(root, "api-fixture"),
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
  return { root, put, environment, metadataPath, reviewed };
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
  for (const argv of [["--foreign"], ["--update", "--update"], "--update"])
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
    KERNEL_API_DIRECTORY: environment.KERNEL_API_DIRECTORY,
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
    "d5827da0f9f6d6ccd9892564cf9183e999620e96e6a47f147feff025fe8167ac",
  );
  await put("src/website/home/Home.tsx", "// Changed owned source bytes.\n");
  await runVisual(root, { environment });
  assert.equal(
    (await json(root, "test-results/visual/environment.json"))
      .sourceFingerprint,
    "dad8340ad201302989a5559b2c52b12af43f48067ea3aa163c83218feb6ac4c4",
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
    "export const chromium={async launch(){process.stdout.write('x'.repeat(5000));await new Promise(()=>setInterval(()=>{},60000));}};\n",
  );
  await assert.rejects(runVisual(root, { environment }), /bounded output/);
  assert.deepEqual(await json(root, metadataPath), reviewed);
  await noFile(root, "capture.json");
  await lockReleased(root);
});

test(
  "probe overflow retains its read failure when direct-child stopping also fails",
  { timeout: 10000 },
  async (t) => {
    const { root, put, environment } = await fixture(t);
    await put(
      "node_modules/@playwright/test/index.mjs",
      "export const chromium={async launch(){process.stdout.write('x'.repeat(5000));await new Promise(()=>setInterval(()=>{},60000));}};\n",
    );
    const ownedChildren = [];
    const original = ChildProcess.prototype.kill;
    const replacement = t.mock.method(
      ChildProcess.prototype,
      "kill",
      function () {
        ownedChildren.push(this);
        throw Error("synthetic owned kill failure");
      },
    );
    try {
      await assert.rejects(runVisual(root, { environment }), (error) => {
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
      });
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
    await lockReleased(root);
  },
);

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

test(
  "aborting an actual owned capture preserves pending review and drains its process",
  { timeout: 10000 },
  async (t) => {
    const { root, put, environment, metadataPath } = await fixture(t);
    // Publish the complete marker before the watcher can stop its writer.
    await put(
      "node_modules/@playwright/test/cli.js",
      `import{renameSync,writeFileSync}from'node:fs';writeFileSync('capture-started.tmp','ready');renameSync('capture-started.tmp','capture-started');setInterval(()=>{},60000);`,
    );
    const controller = new AbortController();
    const watcher = watch(root, (_event, name) => {
      if (String(name) === "capture-started") controller.abort();
    });
    try {
      await assert.rejects(
        runVisual(root, {
          environment,
          argv: ["--update"],
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        }),
        /aborted/,
      );
    } finally {
      watcher.close();
    }
    assert.equal(
      await readFile(path.join(root, "capture-started"), "utf8"),
      "ready",
    );
    assert.equal((await json(root, metadataPath)).review.status, "pending");
    await lockReleased(root);
  },
);
