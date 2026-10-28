import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
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

import { createApiFixture } from "./api-fixture-test-support.mjs";
import {
  assertPlaywrightParentEnvironment,
  createPlaywrightConfig,
} from "./playwright-config.mjs";
import { syntheticRunnerInputs } from "./runner-inputs.mjs";

test("all four actual configuration entries refuse execution without required public inputs", async () => {
  const marker = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  for (const mode of ["smoke", "staging", "visual", "website"]) {
    const url = new URL(`../playwright.${mode}.config.ts`, import.meta.url)
      .href;
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `delete process.env.NODE_V8_COVERAGE; await import(${JSON.stringify(url)});`,
      ],
      {
        env:
          typeof process.env.SystemRoot === "string"
            ? { SystemRoot: process.env.SystemRoot }
            : {},
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    const missingInput =
      mode === "smoke" || mode === "staging"
        ? new RegExp(`${mode.toUpperCase()}_`)
        : /KERNEL_SYNTHETIC_ENV/;
    assert.match(
      result.stderr,
      marker.applicationReady ? missingInput : /non-runnable/,
    );
  }
});

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-playwright-config-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-playwright-config-"));
    await rm(root, { force: true, recursive: true });
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
    applicationReady: ready,
    schemaVersion: 1,
  });
  return { put, root };
}

async function sdk(put) {
  const devDependencies = { "@playwright/test": "1.64.1" };
  await put("package.json", { devDependencies, name: "kernel-website" });
  await put("package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": { devDependencies, name: "kernel-website" },
      "node_modules/@playwright/test": { version: "1.64.1" },
    },
  });
  await put("node_modules/@playwright/test/package.json", {
    bin: { playwright: "cli.js" },
    name: "@playwright/test",
    version: "1.64.1",
  });
  await put(
    "node_modules/@playwright/test/cli.js",
    'throw new Error("SDK CLI must not execute");',
  );
  await put(
    "node_modules/@playwright/test/index.mjs",
    "// Owned SDK identity marker, never imported.\n",
  );
}

async function synthetic(t, put, root) {
  await sdk(put);
  await createApiFixture(
    t,
    put,
    path.join(root, "synthetic-api"),
    'throw new Error("API must not execute");',
  );
  return {
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    KERNEL_API_DIRECTORY: path.join(root, "synthetic-api"),
    KERNEL_SYNTHETIC_ENV: "1",
    NODE_ENV: "production",
    PORT: "43102",
    WEBSITE_CSP_MODE: "enforce",
    WEBSITE_INDEXING_ENABLED: "false",
    WEBSITE_URL: "http://127.0.0.1:43102",
  };
}

test("every configuration refuses a false marker before options, environment or SDK reads", async (t) => {
  const { root } = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("options were read");
      },
    },
  );
  for (const mode of ["smoke", "staging", "visual", "website", "unknown"])
    await assert.rejects(
      createPlaywrightConfig(root, mode, poison),
      /non-runnable/,
    );
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, poison),
    /non-runnable/,
  );
});

test("ambient parent policy rejects private and injection key names without reading values", async (t) => {
  const { root } = await fixture(t);
  let privateReads = 0;
  for (const key of [
    "SECRET",
    "NODE_OPTIONS",
    "NODE_V8_COVERAGE",
    "PW_TEST_SOURCE_TRANSFORM",
    "PW_TEST_SOURCE_TRANSFORM_SCOPE",
  ]) {
    const environment = {};
    Object.defineProperty(environment, key, {
      get() {
        privateReads++;
        throw new Error("private value read");
      },
    });
    await assert.rejects(
      assertPlaywrightParentEnvironment(root, environment),
      /filtered parent environment/,
    );
  }
  assert.equal(privateReads, 0);
  const windowsContext = {};
  for (const key of [
    "HOMEDRIVE",
    "HOMEPATH",
    "LOGONSERVER",
    "SYSTEMDRIVE",
    "USERDOMAIN",
    "USERNAME",
    "USERPROFILE",
    "WINDIR",
  ])
    Object.defineProperty(windowsContext, key, {
      get() {
        throw new Error("OS context value read");
      },
    });
  if (process.platform === "win32")
    await assertPlaywrightParentEnvironment(root, windowsContext);
  else
    await assert.rejects(
      assertPlaywrightParentEnvironment(root, windowsContext),
      /filtered parent environment/,
    );
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, {
      [Symbol("unexpected")]: "value",
    }),
    /filtered parent environment/,
  );
  for (const value of [undefined, null, [], "wrong"])
    await assert.rejects(
      assertPlaywrightParentEnvironment(root, value),
      /explicit object/,
    );
});

test("the SDK worker marker accepts only literal 1 with the reviewed installed SDK identity", async (t) => {
  const { root, put } = await fixture(t);
  for (const value of [
    undefined,
    null,
    true,
    "0",
    "true",
    "--import=untrusted",
  ])
    await assert.rejects(
      assertPlaywrightParentEnvironment(root, { PLAYWRIGHT_TEST: value }),
      /literal string 1/,
    );
  let markerReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "PLAYWRIGHT_TEST", {
    get() {
      markerReads++;
      throw new Error("accessor must not execute");
    },
  });
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, accessor),
    /literal string 1/,
  );
  assert.equal(markerReads, 0);
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, { PLAYWRIGHT_TEST: "1" }),
    /ENOENT/,
  );
  await sdk(put);
  assert.equal(
    await assertPlaywrightParentEnvironment(root, { PLAYWRIGHT_TEST: "1" }),
    root,
  );
  for (const key of [
    "NODE_OPTIONS",
    "NODE_V8_COVERAGE",
    "PW_TEST_SOURCE_TRANSFORM",
    "PW_TEST_SOURCE_TRANSFORM_SCOPE",
  ])
    await assert.rejects(
      assertPlaywrightParentEnvironment(root, {
        PLAYWRIGHT_TEST: "1",
        [key]: "untrusted",
      }),
      /filtered parent environment/,
    );
  const devDependencies = { "@playwright/test": "1.64.2" };
  await put("package.json", { name: "kernel-website", devDependencies });
  await put("package-lock.json", {
    lockfileVersion: 3,
    packages: {
      "": { name: "kernel-website", devDependencies },
      "node_modules/@playwright/test": { version: "1.64.2" },
    },
  });
  await put("node_modules/@playwright/test/package.json", {
    name: "@playwright/test",
    version: "1.64.2",
    bin: { playwright: "cli.js" },
  });
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, { PLAYWRIGHT_TEST: "1" }),
    /reviewed installed Playwright 1.64.1/,
  );
});

test("parent rejection reports only bounded JSON-escaped key names without reading values", async (t) => {
  const { root } = await fixture(t);
  let reads = 0;
  const environment = {};
  for (let index = 0; index < 20; index++)
    Object.defineProperty(
      environment,
      `unexpected\n${index}${"a".repeat(200)}`,
      {
        get() {
          reads++;
          throw new Error("private value must not be read");
        },
      },
    );
  await assert.rejects(
    assertPlaywrightParentEnvironment(root, environment),
    (error) => {
      assert.match(error.message, /unexpected\\n0/);
      assert.match(error.message, /20 names, 0 symbols/);
      assert.ok(error.message.length < 1600);
      assert.equal(error.message.includes("private value"), false);
      return true;
    },
  );
  assert.equal(reads, 0);
});

test("actual SDK-parent load accepts only a filtered explicit environment and known SDK worker controls", async (t) => {
  const { put, root } = await fixture(t);
  const environment = {
    ...(await synthetic(t, put, root)),
    BROWSERSLIST_IGNORE_OLD_DATA: "true",
    DEBUG_COLORS: "1",
    FORCE_COLOR: "1",
    PLAYWRIGHT_BROWSERS_PATH: "0",
    TEST_PARALLEL_INDEX: "0",
    TEST_WORKER_INDEX: "0",
    ...(typeof process.env.SystemRoot === "string"
      ? { SystemRoot: process.env.SystemRoot }
      : {}),
  };
  await assertPlaywrightParentEnvironment(root, environment);
  const moduleUrl = new URL("./playwright-config.mjs", import.meta.url).href;
  const fixtureSupportUrl = new URL(
    "./api-fixture-test-support.mjs",
    import.meta.url,
  ).href;
  // Node's test coverage injects this startup key even with an explicit child
  // environment. The native collector is already initialized at this point;
  // remove only its key before exercising the production parent-name guard.
  const source = `delete process.env.NODE_V8_COVERAGE; const childProcess = (await import('node:child_process')).default; const {apiGitMock}=await import(${JSON.stringify(fixtureSupportUrl)}); childProcess.execFile=apiGitMock(${JSON.stringify(environment.KERNEL_API_DIRECTORY)}); const { loadPlaywrightConfig } = await import(${JSON.stringify(moduleUrl)}); const config = await loadPlaywrightConfig(${JSON.stringify(root)}, "website"); console.log(JSON.stringify({ baseURL: config.use.baseURL, retries: config.retries }));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    {
      encoding: "utf8",
      env: environment,
      timeout: 10_000,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    baseURL: environment.WEBSITE_URL,
    retries: 0,
  });
});

test("unknown configuration and absent root-owned SDK fail before target access", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(
    createPlaywrightConfig(root, "unknown"),
    /Unknown browser/,
  );
  const environment = new Proxy(
    {},
    {
      get() {
        throw new Error("targets were read");
      },
    },
  );
  await assert.rejects(
    createPlaywrightConfig(root, "smoke", { environment }),
    /ENOENT/,
  );
});

test("website data uses explicit fixture origins and filtered environments without starting services", async (t) => {
  const { put, root } = await fixture(t);
  const environment = await synthetic(t, put, root);
  Object.defineProperty(environment, "TOKEN", {
    get() {
      throw new Error("private input read");
    },
  });
  const config = await createPlaywrightConfig(root, "website", { environment });

  assert.equal(config.use.baseURL, environment.WEBSITE_URL);
  assert.equal(config.projects[0].use.browserName, "chromium");
  assert.equal(config.forbidOnly, false);
  assert.equal(config.retries, 0);
  assert.equal(config.workers, 1);
  assert.equal(config.webServer[0].url, `${environment.API_BASE_URL}/health`);
  assert.equal(config.webServer[1].url, `${environment.WEBSITE_URL}/login`);
  const apiLauncherInputs = await syntheticRunnerInputs(
    root,
    config.webServer[0].env,
  );
  assert.equal(config.webServer[0].env.PORT, "43102");
  assert.equal(apiLauncherInputs.websiteEnvironment.PORT, "43102");
  assert.equal(apiLauncherInputs.apiEnvironment.PORT, "43101");
  assert.equal(apiLauncherInputs.apiOrigin, environment.API_BASE_URL);
  assert.equal(config.webServer[1].env.PORT, "43102");
  for (const server of config.webServer) {
    assert.equal(server.cwd, root);
    assert.equal(server.reuseExistingServer, false);
    assert.equal(
      server.env.KERNEL_API_DIRECTORY,
      environment.KERNEL_API_DIRECTORY,
    );
    assert.equal(Object.hasOwn(server.env, "TOKEN"), false);
  }
  assert.equal(config.testDir, path.join(root, "e2e", "website"));
  await assert.rejects(access(path.join(root, "test-results")), /ENOENT/);
});

test("website configuration refuses missing or non-loopback fixture inputs", async (t) => {
  const { put, root } = await fixture(t);
  const environment = await synthetic(t, put, root);
  await assert.rejects(
    createPlaywrightConfig(root, "website", { environment: {} }),
    /KERNEL_SYNTHETIC_ENV/,
  );
  await assert.rejects(
    createPlaywrightConfig(root, "website", {
      environment: {
        ...environment,
        API_BASE_URL: "https://external.example.test",
      },
    }),
    /loopback/,
  );
  const config = await createPlaywrightConfig(root, "website", {
    environment: { ...environment, CI: "1" },
  });
  assert.equal(config.forbidOnly, true);
});

test("visual data preserves exact thresholds and denies CI updates and unguarded loading", async (t) => {
  const { put, root } = await fixture(t);
  const environment = await synthetic(t, put, root);
  await assert.rejects(
    createPlaywrightConfig(root, "visual", { environment }),
    /guarded visual runner/,
  );
  environment.KERNEL_VISUAL_RUNNER = "1";
  await assert.rejects(
    createPlaywrightConfig(root, "visual", { argv: [42], environment }),
    /explicit strings/,
  );
  await assert.rejects(
    createPlaywrightConfig(root, "visual", {
      argv: ["--update-snapshots", "--update-snapshots=none"],
      environment,
    }),
    /guarded all-snapshots/,
  );
  await assert.rejects(
    createPlaywrightConfig(root, "visual", {
      argv: ["--update-snapshots"],
      environment: { ...environment, CI: "false" },
    }),
    /forbidden in CI/,
  );

  const comparison = await createPlaywrightConfig(root, "visual", {
    argv: [],
    environment,
  });
  assert.equal(comparison.updateSnapshots, "none");
  assert.equal(comparison.expect.toHaveScreenshot.maxDiffPixels, 40);
  assert.equal(comparison.expect.toHaveScreenshot.threshold, 0.1);
  assert.equal(
    comparison.snapshotPathTemplate,
    "{testDir}/baselines/{platform}/{arg}{ext}",
  );
  assert.equal(comparison.use.channel, "chromium");
  assert.equal(comparison.use.serviceWorkers, "block");
  const update = await createPlaywrightConfig(root, "visual", {
    argv: ["--update-snapshots=all"],
    environment,
  });
  assert.equal(update.updateSnapshots, "all");
});

test("operational configurations retain only validated target data without network or SDK execution", async (t) => {
  const { put, root } = await fixture(t);
  await sdk(put);
  const staging = {
    STAGING_ALLOWED_API_HOST: "api.staging.example.test",
    STAGING_ALLOWED_APP_HOST: "staging.example.test",
    STAGING_API_HEALTH_URL: "https://api.staging.example.test/health",
    STAGING_BASE_URL: "https://staging.example.test/",
  };
  Object.defineProperty(staging, "SECRET", {
    get() {
      throw new Error("private input read");
    },
  });
  const staged = await createPlaywrightConfig(root, "staging", {
    environment: staging,
  });
  assert.equal(staged.use.baseURL, staging.STAGING_BASE_URL);
  assert.deepEqual(
    staged.projects.map((project) => project.use.browserName),
    ["chromium", "firefox", "webkit"],
  );
  assert.equal(
    staged.metadata.kernelBrowserTargets.apiHealthUrl,
    staging.STAGING_API_HEALTH_URL,
  );
  assert.equal(staged.webServer, undefined);
  assert.equal(staged.forbidOnly, true);
  await assert.rejects(
    createPlaywrightConfig(root, "staging", {
      environment: {
        ...staging,
        STAGING_ALLOWED_APP_HOST: "other.example.test",
      },
    }),
    /not explicitly allowed/,
  );

  const smoke = Object.fromEntries(
    Object.entries(staging).map(([key, value]) => [
      key.replace("STAGING_", "SMOKE_"),
      value,
    ]),
  );
  smoke.SMOKE_DEPLOYMENT_ID = "synthetic-123";
  smoke.SMOKE_EXPECTED_DEPLOYMENT_ID = "synthetic-123";
  const release = await createPlaywrightConfig(root, "smoke", {
    environment: smoke,
  });
  assert.equal(release.projects.length, 1);
  assert.equal(
    release.metadata.kernelBrowserTargets.deploymentId,
    "synthetic-123",
  );
  assert.equal(release.metadata.kernelBrowserTargets.mode, "smoke");
  await assert.rejects(
    createPlaywrightConfig(root, "smoke", {
      environment: { ...smoke, SMOKE_EXPECTED_DEPLOYMENT_ID: "wrong-release" },
    }),
    /expected deployment/,
  );
});
