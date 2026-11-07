import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import { abortOnFixtureFile } from "./runner.test-support.mjs";
import { runCspReportOnly } from "./test-csp-report-only.mjs";
import { recordVerificationBuild } from "./verification-build.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-csp-runner-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-csp-runner-"));
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
    ],
  });
  await put(".nvmrc", process.version.slice(1));
  await put("public/logo.svg", "owned public source");
  await put("package.json", {
    name: "kernel-website",
    type: "module",
    dependencies: { next: "16.4.3" },
    devDependencies: { "@playwright/test": "1.64.1" },
  });
  await put("package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": {
        name: "kernel-website",
        dependencies: { next: "16.4.3" },
        devDependencies: { "@playwright/test": "1.64.1" },
      },
      "node_modules/@playwright/test": {
        version: "1.64.1",
        dependencies: { playwright: "1.64.1" },
      },
      "node_modules/next": { version: "16.4.3" },
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
  await put("node_modules/next/package.json", {
    name: "next",
    version: "16.4.3",
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
  for (const filename of [
    "playwright/lib/program.js",
    "playwright/test.js",
    "playwright/test.mjs",
    "playwright-core/index.js",
    "playwright-core/index.mjs",
  ])
    await put(`node_modules/${filename}`, "// Owned inert transitive SDK.\n");
  await put(
    "playwright.website.config.ts",
    "// Owned fake config; not loaded by fake CLI.\n",
  );
  await put("e2e/website/csp.spec.ts", "// Owned fake browser spec.\n");
  await createApiFixture(put);
  const environment = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",

    NODE_OPTIONS: "--invalid-option",
    TOKEN: "synthetic-disallowed",
  };
  const prepareBuild = async () => {
    await put(".next/BUILD_ID", "owned-build");
    await put(".next/static/chunk.js", "owned static output");
    await put(".next/standalone/server.js", "// Owned prepared server.\n");
    await recordVerificationBuild(root, { environment });
  };
  return { root, put, environment, prepareBuild };
}

test("CSP runner imports stay inert and its actual CLI refuses absent public inputs", async () => {
  const marker = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const target = new URL("test-csp-report-only.mjs", import.meta.url);
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

test("CSP readiness and cancellation precede option/environment reads", async (t) => {
  const { root } = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw Error("options read before readiness");
      },
    },
  );
  await assert.rejects(runCspReportOnly(root, poison), /applicationReady:true/);
  const ready = await fixture(t);
  await assert.rejects(
    runCspReportOnly(ready.root, {
      signal: AbortSignal.abort(),
      get environment() {
        throw Error("environment read after abort");
      },
    }),
    /aborted/,
  );
  await assert.rejects(
    runCspReportOnly(ready.root, { signal: {} }),
    /AbortSignal/,
  );
});

test("CSP wrapper rejects every extra argument before resolving the SDK", async (t) => {
  const { root } = await fixture(t);
  for (const argv of [["--update"], "test", ["e2e/foreign.spec.ts"]])
    await assert.rejects(
      runCspReportOnly(root, { argv }),
      /no extra arguments/,
    );
});

test("CSP wrapper executes the exact owned CLI with public origins and forced report-only skip-build mode", async (t) => {
  const { root, put, environment, prepareBuild } = await fixture(t);
  await prepareBuild();
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{writeFileSync}from'node:fs';writeFileSync('csp-execution.json',JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),environment:process.env}));`,
  );
  assert.deepEqual(
    await runCspReportOnly(root, {
      environment,
      stdio: "ignore",
    }),
    { code: 0, signal: null },
  );
  const actual = JSON.parse(
    await readFile(path.join(root, "csp-execution.json"), "utf8"),
  );
  assert.equal(actual.cwd, root);
  assert.deepEqual(actual.args, [
    "test",
    `--config=${path.join(root, "playwright.website.config.ts")}`,
    "e2e/website/csp.spec.ts",
  ]);
  for (const [key, value] of Object.entries({
    API_BASE_URL: environment.API_BASE_URL,
    WEBSITE_URL: environment.WEBSITE_URL,

    WEBSITE_CSP_MODE: "report-only",
    WEBSITE_TEST_CSP_MODE: "report-only",
    WEBSITE_SKIP_BUILD: "1",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  }))
    assert.equal(actual.environment[key], value);
  for (const key of ["NODE_OPTIONS", "TOKEN"])
    assert.equal(Object.hasOwn(actual.environment, key), false);
});

test("CSP report-only acceptance refuses unverified or stale prepared builds before launching", async (t) => {
  const { root, put, environment, prepareBuild } = await fixture(t);
  await put(
    "node_modules/@playwright/test/cli.js",
    "import{writeFileSync}from'node:fs';writeFileSync('unexpected-csp-start', 'started');",
  );
  await assert.rejects(runCspReportOnly(root, { environment }));
  await prepareBuild();
  await put("public/logo.svg", "changed admitted source");
  await assert.rejects(runCspReportOnly(root, { environment }));
  await assert.rejects(readFile(path.join(root, "unexpected-csp-start")), {
    code: "ENOENT",
  });
});

test("CSP actual child failures and cancellation remain observable failures", async (t) => {
  const { root, put, environment, prepareBuild } = await fixture(t);
  await prepareBuild();
  await put("node_modules/@playwright/test/cli.js", "process.exitCode=7;\n");
  await assert.rejects(
    runCspReportOnly(root, { environment, stdio: "ignore" }),
    /code 7/,
  );
  await put(
    "node_modules/@playwright/test/cli.js",
    "import{createServer}from'node:net';import{writeFileSync,renameSync}from'node:fs';createServer().listen(0,'127.0.0.1');writeFileSync('csp-started.tmp','ready');renameSync('csp-started.tmp','csp-started');\n",
  );
  const controller = new AbortController();
  await assert.rejects(
    abortOnFixtureFile(root, "csp-started", controller, () =>
      runCspReportOnly(root, {
        environment,
        stdio: "ignore",
        signal: controller.signal,
      }),
    ),
    /aborted/,
  );
});
