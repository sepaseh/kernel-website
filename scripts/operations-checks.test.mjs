import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  operationsBrowserEnvironment,
  prepareDastContext,
  runOperationsCheck,
} from "./operations-checks.mjs";
import { assertPlaywrightParentEnvironment } from "./playwright-config.mjs";

test("DAST context confines spider scope to the validated origin without changing its target", async (t) => {
  const { root } = await fixture(t);
  const environment = {
    DAST_TARGET: "https://staging.example.com:444/login?x=1",
    DAST_ALLOWED_HOST: "staging.example.com",
    DAST_PRODUCTION_HOST: "example.com",
  };
  const filename = await runOperationsCheck(root, "dast-context", {
    environment,
  });
  assert.equal(
    filename,
    path.join(root, "test-results/dast/authorized.context"),
  );
  const context = await readFile(filename, "utf8");
  if (process.platform !== "win32")
    assert.equal((await stat(filename)).mode & 0o777, 0o644);
  const pattern = context.match(/<incregexes>\(\?i\)(.*?)<\/incregexes>/)[1];
  assert.deepEqual(
    [...context.matchAll(/<include>(.*?)<\/include>/g)].map(
      (match) => match[1],
    ),
    ["Db", "Language", "OS", "SCM", "WS"],
  );
  const scope = new RegExp(pattern, "i");
  for (const value of [
    "https://staging.example.com:444/",
    environment.DAST_TARGET,
  ])
    assert.equal(scope.test(value), true);
  for (const value of [
    "https://staging-example.com:444/",
    "https://staging.example.com.attacker.test:444/",
    "https://example.com:444/",
    "http://staging.example.com:444/",
    "https://staging.example.com:445/",
  ])
    assert.equal(scope.test(value), false);
  assert.equal(
    environment.DAST_TARGET,
    "https://staging.example.com:444/login?x=1",
  );
  await assert.rejects(prepareDastContext(root, environment), {
    code: "EEXIST",
  });
  assert.equal(await readFile(filename, "utf8"), context);
});

test("DAST context preparation checks readiness and authorization before writing", async (t) => {
  const { root } = await fixture(t, false);
  const unread = new Proxy(
    {},
    {
      get() {
        throw new Error("unexpected target read");
      },
    },
  );
  await assert.rejects(prepareDastContext(root, unread), /non-runnable/);
  await assert.rejects(access(path.join(root, "test-results")), {
    code: "ENOENT",
  });
  const ready = await fixture(t);
  await assert.rejects(
    prepareDastContext(ready.root, {
      DAST_TARGET: "https://other.test",
      DAST_ALLOWED_HOST: "staging.example.com",
      DAST_PRODUCTION_HOST: "example.com",
    }),
    /not explicitly allowed/,
  );
  await assert.rejects(access(path.join(ready.root, "test-results")), {
    code: "ENOENT",
  });
  await assert.rejects(
    runOperationsCheck(ready.root, "dast-context", { arguments: ["extra"] }),
    /no extra arguments/,
  );
});

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-operations-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-operations-"));
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
  await put("package.json", {
    name: "kernel-website",
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
    await put(
      `node_modules/${name}`,
      "// Inert synthetic transitive SDK entry.\n",
    );
  await put(
    "node_modules/@playwright/test/cli.js",
    "throw new Error('Must never execute fixture CLI');",
  );
  return { root, put };
}

const targets = (mode) => {
  const prefix = mode.toUpperCase();
  return {
    [prefix + "_BASE_URL"]: "https://website.fixture.test",
    [prefix + "_API_HEALTH_URL"]: "https://api.fixture.test/health",
    [prefix + "_ALLOWED_APP_HOST"]: "website.fixture.test",
    [prefix + "_ALLOWED_API_HOST"]: "api.fixture.test",
    ...(mode === "smoke"
      ? {
          SMOKE_DEPLOYMENT_ID: "fixture-release",
          SMOKE_EXPECTED_DEPLOYMENT_ID: "fixture-release",
        }
      : {}),
  };
};

test("operations import is inert without runtime settings or signal handlers", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const n=process.listenerCount('SIGTERM'); await import(" +
        JSON.stringify(
          import.meta.url.replace(
            "operations-checks.test.mjs",
            "operations-checks.mjs",
          ),
        ) +
        "); if(process.listenerCount('SIGTERM')!==n) throw new Error('listener changed');",
    ],
    {
      env:
        process.platform === "win32"
          ? { SystemRoot: process.env.SystemRoot }
          : {},
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("readiness precedes options, targets, SDK identity and execution", async (t) => {
  const { root } = await fixture(t, false);
  const options = new Proxy(
    {},
    {
      get() {
        throw new Error("Options inspected too early");
      },
    },
  );
  await assert.rejects(
    runOperationsCheck(root, "smoke", options),
    /non-runnable/,
  );
  await assert.rejects(
    operationsBrowserEnvironment(root, "staging", options),
    /non-runnable/,
  );
});

test("manual browser runs use exact SDK and public allowlisted environment only", async (t) => {
  const { root } = await fixture(t);
  for (const mode of ["smoke", "staging"]) {
    const inherited = {
      ...targets(mode),
      PATH: "public-path",
      TEMP: "public-temp",
      CI: "true",
    };
    Object.defineProperty(inherited, "GITHUB_TOKEN", {
      get() {
        throw new Error("Private value read");
      },
    });
    let executed;
    const controller = new AbortController();
    await runOperationsCheck(root, mode, {
      environment: inherited,
      signal: controller.signal,
      execute: async (value) => {
        executed = value;
      },
    });
    assert.equal(executed.cwd, root);
    assert.equal(executed.signal, controller.signal);
    assert.deepEqual(executed.args, [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config=" + path.join(root, "playwright." + mode + ".config.ts"),
    ]);
    assert.equal(executed.env.GITHUB_TOKEN, undefined);
    assert.equal(executed.env.CI, "1");
    assert.equal(executed.env.PLAYWRIGHT_BROWSERS_PATH, "0");
    await assertPlaywrightParentEnvironment(root, executed.env);
  }
  const minimal = await operationsBrowserEnvironment(
    root,
    "staging",
    targets("staging"),
  );
  assert.equal(minimal.CI, "");
  assert.equal(minimal.PATH, undefined);
});

test("invalid targets fail before reading absent SDK or spawning", async (t) => {
  const { root, put } = await fixture(t);
  await put("node_modules/@playwright/test/package.json", "not json");
  await assert.rejects(
    runOperationsCheck(root, "smoke", {
      environment: {
        ...targets("smoke"),
        SMOKE_EXPECTED_DEPLOYMENT_ID: "wrong",
      },
      execute() {
        throw new Error("Unexpected execution");
      },
    }),
    /expected deployment/,
  );
  await assert.rejects(
    runOperationsCheck(root, "staging", {
      environment: {
        ...targets("staging"),
        STAGING_BASE_URL: "https://other.fixture.test",
      },
    }),
    /not explicitly allowed/,
  );
});

test("dependency drift and execution failures remain observable", async (t) => {
  const { root, put } = await fixture(t);
  await assert.rejects(
    runOperationsCheck(root, "staging", {
      environment: targets("staging"),
      execute: async () => {
        throw new Error("owned child failed");
      },
    }),
    /owned child failed/,
  );
  await put("node_modules/@playwright/test/package.json", {
    name: "@playwright/test",
    version: "0.0.0",
    bin: { playwright: "cli.js" },
  });
  await assert.rejects(
    runOperationsCheck(root, "staging", { environment: targets("staging") }),
    /exact manifest and lock/,
  );
});

test("packaging requires an explicit release and never receives ambient settings", async (t) => {
  const { root } = await fixture(t);
  let captured;
  const result = await runOperationsCheck(root, "package", {
    arguments: ["--release", "fixture-123"],
    environment: new Proxy(
      {},
      {
        get() {
          throw new Error("Package inspected environment");
        },
      },
    ),
    package: async (value) => {
      captured = value;
      return "packaged";
    },
  });
  assert.equal(result, "packaged");
  assert.deepEqual(captured, {
    repositoryRoot: root,
    releaseId: "fixture-123",
  });
  await assert.rejects(runOperationsCheck(root, "package"), /Usage/);
  await assert.rejects(
    runOperationsCheck(root, "package", {
      arguments: ["--release=../outside"],
    }),
    /Release ID/,
  );
});

test("unsupported arguments, cancellation and malformed public inputs fail closed", async (t) => {
  const { root, put } = await fixture(t);
  await assert.rejects(
    runOperationsCheck(root, "unknown"),
    /Unknown operational/,
  );
  await assert.rejects(
    runOperationsCheck(root, "smoke", { signal: {} }),
    /AbortSignal/,
  );
  const controller = new AbortController();
  controller.abort(new Error("cancelled fixture"));
  await assert.rejects(
    runOperationsCheck(root, "smoke", { signal: controller.signal }),
    /cancelled fixture/,
  );
  for (const args of ["bad", [7]])
    await assert.rejects(
      runOperationsCheck(root, "smoke", { arguments: args }),
      /explicit strings/,
    );
  await assert.rejects(
    runOperationsCheck(root, "staging", { arguments: ["--project=foreign"] }),
    /no extra arguments/,
  );
  await assert.rejects(
    operationsBrowserEnvironment(root, "unknown", {}),
    /Expected smoke/,
  );
  for (const value of [null, [], false])
    await assert.rejects(
      operationsBrowserEnvironment(root, "staging", value),
      /explicit object/,
    );
  for (const value of [42, "bad\npath"])
    await assert.rejects(
      operationsBrowserEnvironment(root, "staging", {
        ...targets("staging"),
        PATH: value,
      }),
      /public strings/,
    );
  await assert.rejects(
    operationsBrowserEnvironment(root, "staging", {
      ...targets("staging"),
      CI: true,
    }),
    /string marker/,
  );
  await put(".env.local", "private fixture marker, never read");
  await assert.rejects(
    runOperationsCheck(root, "package", { arguments: ["--release=x"] }),
    /without runtime dotenv/,
  );
});
