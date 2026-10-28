import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  assertPlaywrightParentEnvironment,
  createPlaywrightConfig,
} from "./playwright-config.mjs";

test("the four actual configuration entries reject the published false phase", async () => {
  for (const mode of ["smoke", "staging", "visual", "website"])
    await assert.rejects(
      import(new URL(`../playwright.${mode}.config.ts`, import.meta.url)),
      /non-runnable/,
    );
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
}

async function synthetic(put, root) {
  await sdk(put);
  await put("synthetic-api/package.json", { name: "kernel-api" });
  await put(
    "synthetic-api/src/index.ts",
    'throw new Error("API must not execute");',
  );
  await put(
    "synthetic-api/scripts/test-website-api.mjs",
    'throw new Error("API fixture must not execute");',
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

test("actual SDK-parent load accepts only a filtered explicit environment and known SDK worker controls", async (t) => {
  const { put, root } = await fixture(t);
  const environment = {
    ...(await synthetic(put, root)),
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
  // Node's test coverage injects this startup key even with an explicit child
  // environment. The native collector is already initialized at this point;
  // remove only its key before exercising the production parent-name guard.
  const source = `delete process.env.NODE_V8_COVERAGE; const { loadPlaywrightConfig } = await import(${JSON.stringify(moduleUrl)}); const config = await loadPlaywrightConfig(${JSON.stringify(root)}, "website"); console.log(JSON.stringify({ baseURL: config.use.baseURL, retries: config.retries }));`;
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
  const environment = await synthetic(put, root);
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
  assert.equal(config.webServer[0].env.PORT, "43101");
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
  const environment = await synthetic(put, root);
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
  const environment = await synthetic(put, root);
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
