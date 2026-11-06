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
import { findPackageJSON } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import {
  resolvePlaywrightCli,
  resolvePlaywrightInstallation,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const container = await realpath(
    await mkdtemp(path.join(parent, "website-browser-inputs-")),
  );
  const root = path.join(container, "website");
  await mkdir(root);
  t.after(async () => {
    assert.equal(path.dirname(container), parent);
    assert.ok(path.basename(container).startsWith("website-browser-inputs-"));
    await rm(container, { recursive: true, force: true });
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
  };
  const installed = {
    name: "@playwright/test",
    version: "1.64.1",
    bin: { playwright: "cli.js" },
    dependencies: { playwright: "1.64.1" },
  };
  const playwright = {
    name: "playwright",
    version: "1.64.1",
    dependencies: { "playwright-core": "1.64.1" },
    exports: {
      "./package.json": "./package.json",
      "./lib/program": "./lib/program.js",
      "./test": { import: "./test.mjs", require: "./test.js" },
    },
  };
  const core = {
    name: "playwright-core",
    version: "1.64.1",
    exports: {
      "./package.json": "./package.json",
      ".": { import: "./index.mjs", require: "./index.js" },
    },
  };
  await put("package.json", manifest);
  await put("package-lock.json", lock);
  await put("node_modules/@playwright/test/package.json", installed);
  await put("node_modules/playwright/package.json", playwright);
  await put("node_modules/playwright-core/package.json", core);
  for (const filename of [
    "playwright/lib/program.js",
    "playwright/test.js",
    "playwright/test.mjs",
    "playwright-core/index.js",
    "playwright-core/index.mjs",
  ])
    await put(
      `node_modules/${filename}`,
      "throw new Error('SDK execution is forbidden during resolution');\n",
    );
  await put(
    "node_modules/@playwright/test/cli.js",
    "// Owned fake CLI; never executes a browser.\n",
  );
  await put(
    "node_modules/@playwright/test/index.mjs",
    "// Owned fake SDK module.\n",
  );
  await createApiFixture(put);
  const inherited = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
  };
  return {
    root,
    container,
    put,
    manifest,
    lock,
    installed,
    playwright,
    core,
    inherited,
  };
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

test("SDK resolution rejects parent and nested transitive installations before execution", async (t) => {
  for (const name of ["playwright", "playwright-core"]) {
    const { root, container } = await fixture(t);
    const destination = path.join(container, "node_modules", name);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(path.join(root, "node_modules", name), destination);
    const owner = path.join(
      root,
      "node_modules",
      name === "playwright"
        ? "@playwright/test/cli.js"
        : "playwright/package.json",
    );
    assert.equal(
      findPackageJSON(name, owner),
      path.join(destination, "package.json"),
    );
    await assert.rejects(resolvePlaywrightCli(root), /root-owned installation/);
    await assert.rejects(
      resolvePlaywrightInstallation(root),
      /root-owned installation/,
    );
  }
  const { root } = await fixture(t);
  const destination = path.join(
    root,
    "node_modules/@playwright/test/node_modules/playwright",
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await rename(path.join(root, "node_modules/playwright"), destination);
  await assert.rejects(resolvePlaywrightCli(root), /root-owned installation/);

  const nestedCore = await fixture(t);
  const coreDestination = path.join(
    nestedCore.root,
    "node_modules/playwright/lib/node_modules/playwright-core",
  );
  await mkdir(path.dirname(coreDestination), { recursive: true });
  await rename(
    path.join(nestedCore.root, "node_modules/playwright-core"),
    coreDestination,
  );
  await assert.rejects(
    resolvePlaywrightCli(nestedCore.root),
    /root-owned installation/,
  );
});

test("SDK resolution rejects transitive metadata and dependency drift", async (t) => {
  const { root, put, lock, installed, playwright, core } = await fixture(t);
  for (const [name, invalid] of [
    [
      "node_modules/@playwright/test/package.json",
      { ...installed, dependencies: {} },
    ],
    [
      "node_modules/playwright/package.json",
      { ...playwright, name: "foreign" },
    ],
    [
      "node_modules/playwright/package.json",
      { ...playwright, version: "1.64.0" },
    ],
    [
      "node_modules/playwright/package.json",
      { ...playwright, dependencies: { "playwright-core": "^1.64.1" } },
    ],
    ["node_modules/playwright-core/package.json", { ...core, name: "foreign" }],
    [
      "node_modules/playwright-core/package.json",
      { ...core, version: "1.64.0" },
    ],
    ...["@playwright/test", "playwright", "playwright-core"].map((name) => [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          [`node_modules/${name}`]: { version: "1.64.0" },
        },
      },
    ]),
    [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          "node_modules/playwright": { version: "1.64.1" },
        },
      },
    ],
    [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          "node_modules/@playwright/test": { version: "1.64.1" },
        },
      },
    ],
  ]) {
    await put(name, invalid);
    await assert.rejects(resolvePlaywrightCli(root), /Playwright/);
    await put("package-lock.json", lock);
    await put("node_modules/@playwright/test/package.json", installed);
    await put("node_modules/playwright/package.json", playwright);
    await put("node_modules/playwright-core/package.json", core);
  }
});

test("SDK resolution validates selected CLI and import entry points without importing them", async (t) => {
  const redirected = await fixture(t);
  await redirected.put(
    "node_modules/playwright/replacement.js",
    "throw new Error('must never execute');\n",
  );
  await redirected.put("node_modules/playwright/package.json", {
    ...redirected.playwright,
    exports: {
      ...redirected.playwright.exports,
      "./lib/program": "./replacement.js",
    },
  });
  await assert.rejects(
    resolvePlaywrightCli(redirected.root),
    /root-owned installation/,
  );
  for (const [name, exported] of [
    ["playwright", "./test"],
    ["playwright-core", "."],
  ]) {
    for (const change of [
      () => "./replacement.mjs",
      (original) => ({
        require: original.require,
        import: "./replacement.mjs",
      }),
      (original) => ({ node: "./replacement.mjs", ...original }),
      (original) => ({ default: original.require, ...original }),
    ]) {
      const { root, put, playwright, core } = await fixture(t);
      const original = name === "playwright" ? playwright : core;
      await put(`node_modules/${name}/package.json`, {
        ...original,
        exports: {
          ...original.exports,
          [exported]: change(original.exports[exported]),
        },
      });
      await assert.rejects(resolvePlaywrightInstallation(root));
    }
  }
  const { root } = await fixture(t);
  assert.ok(await resolvePlaywrightInstallation(root));
  await rm(path.join(root, "node_modules/playwright/test.mjs"));
  assert.ok(await resolvePlaywrightCli(root));
  await assert.rejects(resolvePlaywrightInstallation(root), /ENOENT/);
});

test("SDK resolution rejects linked transitive packages", async (t) => {
  const { root } = await fixture(t);
  const installed = path.join(root, "node_modules/playwright-core");
  const moved = path.join(root, "owned-core");
  await rename(installed, moved);
  await symlink(
    moved,
    installed,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(resolvePlaywrightCli(root), /root-owned|links|unlinked/);
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
  assert.equal(actual.websiteOrigin, inherited.WEBSITE_URL);
  assert.equal(actual.apiOrigin, inherited.API_BASE_URL);
  for (const environment of [
    actual.websiteEnvironment,
    actual.apiEnvironment,
  ]) {
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
