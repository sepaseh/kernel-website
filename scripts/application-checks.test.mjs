import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import { runApplicationCheck } from "./application-checks.mjs";

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-application-check-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-application-check-"));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (filename, value) => {
    const target = path.join(root, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      target,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: ready,
  });
  const manifest = {
    name: "kernel-website",
    type: "module",
    dependencies: { next: "16.4.3" },
    devDependencies: { knip: "6.12.2", "@playwright/test": "1.64.1" },
  };
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": manifest,
      "node_modules/next": { version: "16.4.3" },
      "node_modules/knip": { version: "6.12.2" },
      "node_modules/@playwright/test": { version: "1.64.1" },
    },
  };
  await put("package.json", manifest);
  await put("package-lock.json", lock);
  for (const [name, version] of [
    ["next", "16.4.3"],
    ["knip", "6.12.2"],
    ["@playwright/test", "1.64.1"],
  ]) {
    await put(`node_modules/${name}/package.json`, {
      name,
      version,
      ...(name === "@playwright/test" ? { bin: { playwright: "cli.js" } } : {}),
    });
  }
  for (const entry of [
    "next/dist/bin/next",
    "knip/bin/knip.js",
    "@playwright/test/cli.js",
  ])
    await put(
      `node_modules/${entry}`,
      "throw new Error('An injected application check must not launch this fake SDK');\n",
    );
  await put("performance-budget.json", {
    version: 1,
    totalJavaScriptBytes: 100,
    largestJavaScriptBytes: 100,
    totalCssBytes: 100,
    routeJavaScriptBytes: 100,
    routeJavaScriptGzipBytes: 100,
    routeCssBytes: 100,
  });
  const apiDirectory = path.join(root, "api-fixture");
  await createApiFixture(t, put, apiDirectory);
  const environment = {
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43101",
    HOSTNAME: "127.0.0.1",
    PORT: "43102",
    WEBSITE_URL: "http://127.0.0.1:43102",
    WEBSITE_INDEXING_ENABLED: "false",
    KERNEL_SYNTHETIC_ENV: "1",
    KERNEL_API_DIRECTORY: apiDirectory,
    TOKEN: "synthetic-disallowed",
    NODE_OPTIONS: "--invalid-option",
  };
  return { root, put, manifest, lock, environment };
}

const measurements = () => ({
  javaScriptBytes: 10,
  largestJavaScriptBytes: 8,
  cssBytes: 3,
  routes: { "/": { javaScriptBytes: 10, javaScriptGzipBytes: 4, cssBytes: 3 } },
});

test("application checks gate readiness before mode, options or execution access", async (t) => {
  const { root } = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("options were read before readiness");
      },
    },
  );
  for (const mode of [
    "dead-code",
    "types",
    "build",
    "e2e",
    "visual",
    "unknown",
  ])
    await assert.rejects(
      runApplicationCheck(root, mode, poison),
      /non-runnable/,
    );
});

test("unknown modes and invalid or cancelled signals fail before public settings access", async (t) => {
  const { root } = await fixture(t);
  const poison = {
    get environment() {
      throw new Error("environment was read");
    },
  };
  await assert.rejects(
    runApplicationCheck(root, "unknown", poison),
    /Unknown application check/,
  );
  const invalid = { signal: {} };
  Object.defineProperty(
    invalid,
    "environment",
    Object.getOwnPropertyDescriptor(poison, "environment"),
  );
  await assert.rejects(
    runApplicationCheck(root, "types", invalid),
    /AbortSignal/,
  );
  const cancelled = {
    signal: AbortSignal.abort(new Error("owned application check cancelled")),
  };
  Object.defineProperty(
    cancelled,
    "environment",
    Object.getOwnPropertyDescriptor(poison, "environment"),
  );
  await assert.rejects(
    runApplicationCheck(root, "e2e", cancelled),
    /owned application check cancelled/,
  );
});

test("application checks require explicit synthetic public settings before dispatch", async (t) => {
  const { root } = await fixture(t);
  let executions = 0;
  await assert.rejects(
    runApplicationCheck(root, "dead-code", {
      environment: {},
      execute() {
        executions++;
      },
    }),
    /KERNEL_SYNTHETIC_ENV/,
  );
  assert.equal(executions, 0);
});

test("dead-code and generated-type checks select only their exact owned SDK entries and sanitized environment", async (t) => {
  const { root, environment } = await fixture(t);
  const controller = new AbortController();
  for (const [mode, expected] of [
    ["dead-code", [path.join(root, "node_modules/knip/bin/knip.js")]],
    ["types", [path.join(root, "node_modules/next/dist/bin/next"), "typegen"]],
  ]) {
    const calls = [];
    const result = await runApplicationCheck(root, mode, {
      environment,
      signal: controller.signal,
      stdio: "ignore",
      execute: async (options) => {
        calls.push(options);
        return "owned execution result";
      },
    });
    assert.equal(result, "owned execution result");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, expected);
    assert.equal(calls[0].cwd, root);
    assert.equal(calls[0].signal, controller.signal);
    assert.equal(calls[0].stdio, "ignore");
    assert.equal(calls[0].env.PORT, "43102");
    assert.equal(calls[0].env.KERNEL_SYNTHETIC_ENV, "1");
    for (const forbidden of ["TOKEN", "NODE_OPTIONS", "KERNEL_API_DIRECTORY"])
      assert.equal(Object.hasOwn(calls[0].env, forbidden), false);
  }
  assert.equal(environment.NODE_OPTIONS, "--invalid-option");
});

test("dead-code checks reject manifest lock installed-version and entry drift before execution", async (t) => {
  const { root, put, manifest, lock, environment } = await fixture(t);
  let executions = 0;
  const options = {
    environment,
    execute() {
      executions++;
    },
  };
  for (const [filename, bad] of [
    ["package.json", { ...manifest, name: "foreign" }],
    [
      "package.json",
      {
        ...manifest,
        devDependencies: { ...manifest.devDependencies, knip: "^6.12.2" },
      },
    ],
    ["package.json", { ...manifest, devDependencies: {} }],
    ["package-lock.json", { ...lock, lockfileVersion: 2 }],
    [
      "package-lock.json",
      {
        ...lock,
        packages: {
          ...lock.packages,
          "": {
            ...manifest,
            devDependencies: { ...manifest.devDependencies, knip: "0.0.0" },
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
          "node_modules/knip": { version: "0.0.0" },
        },
      },
    ],
    ["node_modules/knip/package.json", { name: "foreign", version: "6.12.2" }],
    ["node_modules/knip/package.json", { name: "knip", version: "0.0.0" }],
  ]) {
    await put(filename, bad);
    await assert.rejects(
      runApplicationCheck(root, "dead-code", options),
      /Knip must match/,
    );
    await put("package.json", manifest);
    await put("package-lock.json", lock);
    await put("node_modules/knip/package.json", {
      name: "knip",
      version: "6.12.2",
    });
  }
  await rm(path.join(root, "node_modules/knip/bin/knip.js"));
  await assert.rejects(
    runApplicationCheck(root, "dead-code", options),
    /ENOENT/,
  );
  assert.equal(executions, 0);
});

test("production build must finish before real budget evaluation and consumes only its selected output", async (t) => {
  const { root, environment } = await fixture(t);
  const order = [];
  await runApplicationCheck(root, "build", {
    environment,
    execute: async (options) => {
      assert.deepEqual(options.args, [
        path.join(root, "node_modules/next/dist/bin/next"),
        "build",
      ]);
      order.push("build");
    },
    measureBundle: async (directory) => {
      assert.equal(directory, path.join(root, ".next"));
      order.push("measure");
      return measurements();
    },
  });
  assert.deepEqual(order, ["build", "measure"]);
});

test("build execution, measurement and budget failures remain required failures", async (t) => {
  const { root, environment } = await fixture(t);
  const buildFailure = new Error("owned build failed");
  let measured = false;
  await assert.rejects(
    runApplicationCheck(root, "build", {
      environment,
      execute: async () => {
        throw buildFailure;
      },
      measureBundle: async () => {
        measured = true;
      },
    }),
    (error) => error === buildFailure,
  );
  assert.equal(measured, false);
  const measurementFailure = new Error("owned bundle graph missing");
  await assert.rejects(
    runApplicationCheck(root, "build", {
      environment,
      execute: async () => {},
      measureBundle: async () => {
        throw measurementFailure;
      },
    }),
    (error) => error === measurementFailure,
  );
  await assert.rejects(
    runApplicationCheck(root, "build", {
      environment,
      execute: async () => {},
      measureBundle: async () => ({ ...measurements(), javaScriptBytes: 101 }),
    }),
    /All browser JavaScript: 101 bytes exceeds 100/,
  );
});

test("e2e dispatch awaits enforce-mode browser completion before report-only CSP and forwards cancellation", async (t) => {
  const { root, environment } = await fixture(t);
  const controller = new AbortController();
  const order = [];
  const result = await runApplicationCheck(root, "e2e", {
    environment,
    signal: controller.signal,
    execute: async (options) => {
      order.push("enforce");
      assert.deepEqual(options.args, [
        path.join(root, "node_modules/@playwright/test/cli.js"),
        "test",
        `--config=${path.join(root, "playwright.website.config.ts")}`,
      ]);
      assert.equal(options.env.WEBSITE_CSP_MODE, "enforce");
      assert.equal(options.env.WEBSITE_SKIP_BUILD, "1");
      assert.equal(options.env.PLAYWRIGHT_BROWSERS_PATH, "0");
      assert.equal(
        options.env.KERNEL_API_DIRECTORY,
        environment.KERNEL_API_DIRECTORY,
      );
      assert.equal(Object.hasOwn(options.env, "TOKEN"), false);
      assert.equal(options.signal, controller.signal);
    },
    reportOnly: async (directory, options) => {
      order.push("report-only");
      assert.equal(directory, root);
      assert.equal(options.signal, controller.signal);
      assert.equal(options.environment.WEBSITE_CSP_MODE, "enforce");
      return "owned report-only result";
    },
  });
  assert.deepEqual(order, ["enforce", "report-only"]);
  assert.equal(result, "owned report-only result");
  assert.equal(Object.hasOwn(environment, "WEBSITE_SKIP_BUILD"), false);
});

test("failed enforce e2e never proceeds to report-only and report-only failure propagates", async (t) => {
  const { root, environment } = await fixture(t);
  const failure = new Error("owned enforce suite failed");
  let reportOnlyCalls = 0;
  await assert.rejects(
    runApplicationCheck(root, "e2e", {
      environment,
      execute: async () => {
        throw failure;
      },
      reportOnly: async () => {
        reportOnlyCalls++;
      },
    }),
    (error) => error === failure,
  );
  assert.equal(reportOnlyCalls, 0);
  const reportFailure = new Error("owned report-only suite failed");
  await assert.rejects(
    runApplicationCheck(root, "e2e", {
      environment,
      execute: async () => {},
      reportOnly: async () => {
        throw reportFailure;
      },
    }),
    (error) => error === reportFailure,
  );
});

test("visual dispatch uses its guarded owner and retains explicit API selection and failure", async (t) => {
  const { root, environment } = await fixture(t);
  const controller = new AbortController();
  let calls = 0;
  const result = await runApplicationCheck(root, "visual", {
    environment,
    signal: controller.signal,
    execute: async () => {
      throw new Error("visual must use its guarded owner");
    },
    visual: async (directory, options) => {
      calls++;
      assert.equal(directory, root);
      assert.equal(options.signal, controller.signal);
      assert.equal(options.environment.WEBSITE_SKIP_BUILD, "1");
      assert.equal(options.environment.WEBSITE_CSP_MODE, "enforce");
      assert.equal(options.environment.PLAYWRIGHT_BROWSERS_PATH, "0");
      assert.equal(
        options.environment.KERNEL_API_DIRECTORY,
        environment.KERNEL_API_DIRECTORY,
      );
      return "owned visual result";
    },
  });
  assert.equal(calls, 1);
  assert.equal(result, "owned visual result");
  const failure = new Error("owned visual comparison failed");
  await assert.rejects(
    runApplicationCheck(root, "visual", {
      environment,
      visual: async () => {
        throw failure;
      },
    }),
    (error) => error === failure,
  );
});

test("default owned process execution exposes a real fake-SDK failure", async (t) => {
  const { root, put, environment } = await fixture(t);
  await put("node_modules/knip/bin/knip.js", "process.exitCode=7;\n");
  await assert.rejects(
    runApplicationCheck(root, "dead-code", {
      environment,
      stdio: "ignore",
      signal: AbortSignal.timeout(5000),
    }),
    /code 7/,
  );
});
