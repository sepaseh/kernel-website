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
import { runCspReportOnly } from "./test-csp-report-only.mjs";

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
    "playwright.website.config.ts",
    "// Owned fake config; not loaded by fake CLI.\n",
  );
  await put("e2e/website/csp.spec.ts", "// Owned fake browser spec.\n");
  await createApiFixture(t, put, path.join(root, "api-fixture"));
  const environment = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: path.join(root, "api-fixture"),
    NODE_OPTIONS: "--invalid-option",
    TOKEN: "synthetic-disallowed",
  };
  return { root, put, environment };
}

test("browser runner imports stay inert and their actual CLIs refuse absent public inputs", async () => {
  const marker = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  for (const name of ["run-visual.mjs", "test-csp-report-only.mjs"]) {
    const target = new URL(name, import.meta.url);
    const importing = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const before=process.listenerCount('SIGTERM');await import(${JSON.stringify(target.href)});if(before!==process.listenerCount('SIGTERM'))throw Error('listener changed');console.log('inert');`,
      ],
      { encoding: "utf8", env: {}, windowsHide: true, timeout: 5000 },
    );
    assert.ifError(importing.error);
    assert.equal(importing.status, 0, importing.stderr);
    assert.equal(importing.stdout.trim(), "inert");
    const executing = spawnSync(process.execPath, [fileURLToPath(target)], {
      encoding: "utf8",
      env: {},
      windowsHide: true,
      timeout: 5000,
    });
    assert.ifError(executing.error);
    assert.equal(executing.status, 1);
    assert.match(
      executing.stderr,
      marker.applicationReady
        ? /KERNEL_SYNTHETIC_ENV/
        : /applicationReady:true/,
    );
  }
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
  const { root, put, environment } = await fixture(t);
  await put(
    "node_modules/@playwright/test/cli.js",
    `import{writeFileSync}from'node:fs';writeFileSync('csp-execution.json',JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),environment:process.env}));`,
  );
  assert.deepEqual(
    await runCspReportOnly(root, {
      environment,
      stdio: "ignore",
      signal: AbortSignal.timeout(5000),
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
    KERNEL_API_DIRECTORY: environment.KERNEL_API_DIRECTORY,
    WEBSITE_CSP_MODE: "report-only",
    WEBSITE_TEST_CSP_MODE: "report-only",
    WEBSITE_SKIP_BUILD: "1",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  }))
    assert.equal(actual.environment[key], value);
  for (const key of ["NODE_OPTIONS", "TOKEN"])
    assert.equal(Object.hasOwn(actual.environment, key), false);
});

test("CSP actual child failures and cancellation remain observable failures", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put("node_modules/@playwright/test/cli.js", "process.exitCode=7;\n");
  await assert.rejects(
    runCspReportOnly(root, { environment, stdio: "ignore" }),
    /code 7/,
  );
  await put(
    "node_modules/@playwright/test/cli.js",
    "setInterval(()=>{},60000);\n",
  );
  await assert.rejects(
    runCspReportOnly(root, {
      environment,
      stdio: "ignore",
      signal: AbortSignal.timeout(100),
    }),
    /aborted/,
  );
});
