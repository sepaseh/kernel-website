import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  resolvePlaywrightCli,
  resolvePlaywrightInstallation,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-browser-inputs-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-browser-inputs-"));
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
  const manifest = {
    name: "kernel-website",
    devDependencies: { "@playwright/test": "1.64.1" },
  };
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": { ...manifest },
      "node_modules/@playwright/test": { version: "1.64.1" },
    },
  };
  const installed = {
    name: "@playwright/test",
    version: "1.64.1",
    bin: { playwright: "cli.js" },
  };
  await put("package.json", manifest);
  await put("package-lock.json", lock);
  await put("node_modules/@playwright/test/package.json", installed);
  await put(
    "node_modules/@playwright/test/cli.js",
    "// Owned fake CLI; never executes a browser.\n",
  );
  await put(
    "node_modules/@playwright/test/index.mjs",
    "// Owned fake SDK module.\n",
  );
  await put("api-fixture/package.json", { name: "kernel-api" });
  await put(
    "api-fixture/src/index.ts",
    "// Owned structural fixture marker.\n",
  );
  await put(
    "api-fixture/scripts/test-website-api.mjs",
    "// Owned synthetic fixture entry.\n",
  );
  const inherited = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: path.join(root, "api-fixture"),
  };
  return { root, put, manifest, lock, installed, inherited };
}

test("browser inputs refuse a false marker before environment or SDK reads", async (t) => {
  const { root } = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("environment read before readiness");
      },
    },
  );
  for (const action of [
    () => resolvePlaywrightCli(root),
    () => resolvePlaywrightInstallation(root),
    () => syntheticBrowserInputs(root, poison),
  ])
    await assert.rejects(action, /applicationReady:true/);
});

test("Playwright resolution uses exactly the owning manifest lock package and CLI", async (t) => {
  const { root } = await fixture(t);
  assert.equal(
    await resolvePlaywrightCli(root),
    path.join(root, "node_modules/@playwright/test/cli.js"),
  );
  assert.deepEqual(await resolvePlaywrightInstallation(root), {
    cli: path.join(root, "node_modules/@playwright/test/cli.js"),
    version: "1.64.1",
    module: path.join(root, "node_modules/@playwright/test/index.mjs"),
  });
});

test("SDK resolution rejects missing ownership and every declared identity/version drift", async (t) => {
  const { root, put, manifest, lock, installed } = await fixture(t);
  for (const [name, invalid] of [
    ["package.json", { ...manifest, name: "foreign" }],
    [
      "package.json",
      { ...manifest, devDependencies: { "@playwright/test": "^1.64.1" } },
    ],
    ["package.json", { name: "kernel-website" }],
    ["package-lock.json", { ...lock, lockfileVersion: 2 }],
    [
      "package-lock.json",
      {
        ...lock,
        packages: { ...lock.packages, "": { ...manifest, name: "foreign" } },
      },
    ],
    [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          "": {
            name: "kernel-website",
            devDependencies: { "@playwright/test": "1.64.0" },
          },
        },
      },
    ],
    [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          "node_modules/@playwright/test": { version: "1.64.0" },
        },
      },
    ],
    [
      "node_modules/@playwright/test/package.json",
      { ...installed, name: "playwright" },
    ],
    [
      "node_modules/@playwright/test/package.json",
      { ...installed, version: "1.64.0" },
    ],
    [
      "node_modules/@playwright/test/package.json",
      { ...installed, bin: { playwright: "../foreign.js" } },
    ],
  ]) {
    await put(name, invalid);
    await assert.rejects(resolvePlaywrightCli(root), /root-owned installed/);
    await put("package.json", manifest);
    await put("package-lock.json", lock);
    await put("node_modules/@playwright/test/package.json", installed);
  }
  await rm(path.join(root, "node_modules/@playwright/test/cli.js"));
  await assert.rejects(resolvePlaywrightCli(root), /ENOENT/);
});

test("CLI resolution needs no SDK import and has no parent/global fallback", async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, "node_modules/@playwright/test/index.mjs"));
  assert.ok(await resolvePlaywrightCli(root));
  await assert.rejects(resolvePlaywrightInstallation(root), /ENOENT/);
  await rm(path.join(root, "node_modules/@playwright/test/package.json"));
  await assert.rejects(resolvePlaywrightCli(root), /ENOENT/);
});

test("SDK links and dotenv presence are rejected without executing or reading them", async (t) => {
  const { root, put, inherited } = await fixture(t);
  const installed = path.join(root, "node_modules/@playwright/test");
  const moved = path.join(root, "owned-sdk");
  await rename(installed, moved);
  await symlink(
    moved,
    installed,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(resolvePlaywrightCli(root), /links|unlinked/);
  assert.match(
    await readFile(path.join(moved, "cli.js"), "utf8"),
    /Owned fake CLI/,
  );
  await put(".env.local", "synthetic unread dotenv marker\n");
  await assert.rejects(
    syntheticBrowserInputs(root, inherited),
    /without runtime dotenv/,
  );
});

test("synthetic browser inputs carry only explicit public loopback and validated API settings", async (t) => {
  const { root, inherited } = await fixture(t);
  const input = {
    ...inherited,
    CI: "false",
    WEBSITE_SKIP_BUILD: "1",
    WEBSITE_TEST_CSP_MODE: "report-only",
    KERNEL_VISUAL_RUNNER: "1",
    NODE_OPTIONS: "--invalid-option",
    TOKEN: "synthetic-secret",
    DATABASE_URL: "synthetic-private",
  };
  const actual = await syntheticBrowserInputs(root, input);
  assert.equal(actual.apiDirectory, inherited.KERNEL_API_DIRECTORY);
  assert.equal(actual.websiteOrigin, inherited.WEBSITE_URL);
  assert.equal(actual.apiOrigin, inherited.API_BASE_URL);
  for (const environment of [
    actual.websiteEnvironment,
    actual.apiEnvironment,
  ]) {
    assert.equal(
      environment.KERNEL_API_DIRECTORY,
      inherited.KERNEL_API_DIRECTORY,
    );
    assert.equal(environment.CI, "1");
    assert.equal(environment.WEBSITE_SKIP_BUILD, "1");
    assert.equal(environment.WEBSITE_TEST_CSP_MODE, "report-only");
    assert.equal(environment.KERNEL_VISUAL_RUNNER, "1");
    for (const key of ["NODE_OPTIONS", "TOKEN", "DATABASE_URL"])
      assert.equal(Object.hasOwn(environment, key), false);
  }
  assert.equal(actual.apiEnvironment.PORT, "43101");
  assert.equal(actual.websiteEnvironment.PORT, "43102");
  assert.equal(
    (await syntheticBrowserInputs(root, inherited)).websiteEnvironment.CI,
    "",
  );
});

test("browser controls reject ambiguous modes and API locations", async (t) => {
  const { root, inherited } = await fixture(t);
  for (const change of [
    { CI: true },
    { WEBSITE_SKIP_BUILD: "true" },
    { WEBSITE_TEST_CSP_MODE: "unknown" },
    { KERNEL_VISUAL_RUNNER: "0" },
    { KERNEL_API_DIRECTORY: "relative" },
    { API_BASE_URL: "https://owner.invalid" },
    { WEBSITE_URL: inherited.API_BASE_URL },
  ])
    await assert.rejects(
      syntheticBrowserInputs(root, { ...inherited, ...change }),
    );
});

test("public browser inputs are snapshotted once before independent validation", async (t) => {
  const { root, inherited } = await fixture(t);
  let reads = 0;
  Object.defineProperty(inherited, "KERNEL_SYNTHETIC_ENV", {
    get() {
      reads++;
      return reads === 1 ? "1" : "0";
    },
  });
  assert.equal(
    (await syntheticBrowserInputs(root, inherited)).apiEnvironment
      .KERNEL_SYNTHETIC_ENV,
    "1",
  );
  assert.equal(reads, 1);
});
