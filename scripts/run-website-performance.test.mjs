import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createApiFixture } from "./api-fixture-test-support.mjs";
import {
  launchLighthouseBrowser,
  resolveLighthouseInstallation,
  runLighthouseSample,
  runWebsitePerformance,
} from "./run-website-performance.mjs";
import { startOwnedProcess } from "./runner-process.mjs";

const metricIds = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "speed-index",
];
const origin = "http://127.0.0.1:43222";
const browserConnection = {
  port: 43223,
  endpoint: "ws://127.0.0.1:43224/owned-browser",
};
function result(score = 0.8, route = "/") {
  return {
    report: [
      "<html>owned synthetic Lighthouse report</html>",
      JSON.stringify({ owned: true }),
    ],
    lhr: {
      lighthouseVersion: "13.6.0",
      requestedUrl: origin + route,
      finalDisplayedUrl: origin + route,
      categories: { performance: { score } },
      audits: {
        ...Object.fromEntries(
          metricIds.map((id, index) => [id, { numericValue: index + 1 }]),
        ),
        "network-requests": {
          details: { items: [{ url: origin + "/font.woff2" }] },
        },
      },
    },
  };
}
const bundle = () => ({
  javaScriptBytes: 1,
  largestJavaScriptBytes: 1,
  cssBytes: 1,
  routes: { "/": { javaScriptBytes: 1, javaScriptGzipBytes: 1, cssBytes: 1 } },
});

async function fixture(t, ready = true) {
  const parent = await realpath(os.tmpdir());
  const root = await realpath(
    await mkdtemp(path.join(parent, "website-owned-lighthouse-")),
  );
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("website-owned-lighthouse-"));
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
  const manifest = {
    name: "kernel-website",
    devDependencies: { lighthouse: "13.6.0", "@playwright/test": "1.64.1" },
  };
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": manifest,
      "node_modules/lighthouse": { version: "13.6.0" },
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
    name: "lighthouse",
    type: "module",
    version: "13.6.0",
    main: "./core/index.js",
  };
  const core = {
    name: "playwright-core",
    version: "1.64.1",
    exports: {
      ".": { import: "./index.mjs", require: "./index.js" },
      "./package.json": "./package.json",
    },
  };
  const browsers = {
    browsers: [
      { name: "chromium", revision: "1248", browserVersion: "156.0.8078.4" },
    ],
  };
  await put(".github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: ready,
  });
  await put("package.json", manifest);
  await put("package-lock.json", lock);
  await put("node_modules/lighthouse/package.json", installed);
  await put("node_modules/lighthouse/core/index.js", "// Owned fake module.\n");
  await put(
    "node_modules/lighthouse/core/config/lr-desktop-config.js",
    "// Owned fake desktop config.\n",
  );
  await put("node_modules/@playwright/test/package.json", {
    name: "@playwright/test",
    version: "1.64.1",
    bin: { playwright: "cli.js" },
    dependencies: { playwright: "1.64.1" },
  });
  await put("node_modules/@playwright/test/cli.js", "// Owned fake CLI.\n");
  await put("node_modules/@playwright/test/index.mjs", "// Owned fake SDK.\n");
  await put("node_modules/playwright/package.json", {
    name: "playwright",
    version: "1.64.1",
    dependencies: { "playwright-core": "1.64.1" },
    exports: {
      "./lib/program": "./lib/program.js",
      "./package.json": "./package.json",
      "./test": { import: "./test.mjs", require: "./test.js" },
    },
  });
  for (const filename of ["lib/program.js", "test.js", "test.mjs"])
    await put("node_modules/playwright/" + filename, "// Owned fake SDK.\n");
  await put("node_modules/playwright-core/package.json", core);
  for (const filename of ["index.js", "index.mjs"])
    await put(
      "node_modules/playwright-core/" + filename,
      "// Owned fake SDK.\n",
    );
  await put("node_modules/playwright-core/browsers.json", browsers);
  const executableLayout = {
    darwin: [
      `chrome-mac-${process.arch}`,
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    ],
    linux: [
      process.arch === "arm64" ? "chrome-linux-arm64" : "chrome-linux64",
      "chrome",
    ],
    win32: ["chrome-win64", "chrome.exe"],
  }[process.platform];
  const executableRelative = path.join(
    "node_modules/playwright-core/.local-browsers/chromium-1248",
    ...executableLayout,
  );
  await put(
    executableRelative,
    "Owned inert executable fixture; never launch this file.\n",
  );
  const executable = path.join(root, executableRelative);
  await chmod(executable, 0o700);
  await put("performance-budget.json", {
    version: 1,
    totalJavaScriptBytes: 100,
    largestJavaScriptBytes: 100,
    totalCssBytes: 100,
    routeJavaScriptBytes: 100,
    routeJavaScriptGzipBytes: 100,
    routeCssBytes: 100,
  });
  await createApiFixture(put);
  const environment = {
    KERNEL_SYNTHETIC_ENV: "1",
    NODE_ENV: "production",
    API_BASE_URL: "http://127.0.0.1:43221",
    WEBSITE_URL: origin,
    HOSTNAME: "127.0.0.1",
    PORT: "43222",
    WEBSITE_INDEXING_ENABLED: "false",

    NODE_OPTIONS: "--unrelated",
    TOKEN: "synthetic-private-marker",
    DATABASE_URL: "synthetic-private-marker",
    HTTPS_PROXY: "synthetic-private-marker",
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  };
  return {
    root,
    put,
    environment,
    manifest,
    lock,
    installed,
    core,
    browsers,
    executable,
  };
}

function orchestration(f, tweaks = {}) {
  const trace = {
    starts: [],
    stops: [],
    samples: [],
    builds: 0,
    activeSamples: 0,
    maximumConcurrentSamples: 0,
    browserStarts: 0,
    browserStops: 0,
  };
  const service =
    (name) =>
    async ({ signal, environment }) => {
      trace.starts.push(name);
      assert.equal(environment.NODE_OPTIONS, undefined);
      await new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            trace.stops.push(name);
            reject(new Error("Owned process was aborted."));
          },
          { once: true },
        );
        if (signal.aborted) reject(new Error("Owned process was aborted."));
      });
    };
  const options = {
    environment: f.environment,
    ports: async (ports) => assert.deepEqual(ports, [43222, 43221]),
    build: async () => {
      trace.builds++;
    },
    measureBundle: async () => bundle(),
    runApi: service("api"),
    runWebsite: service("website"),
    ready: async (_url, owned) => {
      owned.assertAlive();
    },
    launchBrowser: async () => {
      trace.browserStarts++;
      return {
        ...browserConnection,
        stop: async () => {
          trace.browserStops++;
        },
      };
    },
    start: (options_) => {
      trace.samples.push(options_);
      assert.equal(options_.env.NODE_OPTIONS, undefined);
      assert.equal(options_.env.DATABASE_URL, undefined);
      assert.equal(options_.env.TOKEN, undefined);
      assert.equal(options_.env.HTTPS_PROXY, undefined);
      assert.equal(options_.env.PLAYWRIGHT_BROWSERS_PATH, "0");
      const value = result(
        [0.91, 0.57, 0.8][(trace.samples.length - 1) % 3],
        options_.args.at(-1),
      );
      const metricValues = [
        [100, 800, 0.04, 60, 500],
        [900, 200, 0.01, 10, 900],
        [300, 500, 0.07, 30, 700],
      ][(trace.samples.length - 1) % 3];
      const group = Math.floor((trace.samples.length - 1) / 3);
      metricIds.forEach((id, index) => {
        value.lhr.audits[id].numericValue =
          metricValues[index] + group * (index === 2 ? 0.1 : 1000);
      });
      const owned = startOwnedProcess({
        ...options_,
        args: [
          "--input-type=module",
          "-e",
          "process.stdout.write(" + JSON.stringify(JSON.stringify(value)) + ")",
        ],
      });
      trace.activeSamples++;
      trace.maximumConcurrentSamples = Math.max(
        trace.maximumConcurrentSamples,
        trace.activeSamples,
      );
      return {
        ...owned,
        completion: owned.completion.finally(() => trace.activeSamples--),
      };
    },
    ...tweaks,
  };
  return { options, trace };
}

test("Lighthouse import is inert and false readiness precedes options/dependencies", async (t) => {
  const f = await fixture(t, false);
  const poison = new Proxy(
    {},
    {
      get() {
        throw new Error("options accessed before readiness");
      },
    },
  );
  await assert.rejects(runWebsitePerformance(f.root, poison), /non-runnable/);
  await assert.rejects(
    runLighthouseSample(f.root, "mobile", "/", poison),
    /non-runnable/,
  );
  await assert.rejects(resolveLighthouseInstallation(f.root), /non-runnable/);
  await assert.rejects(launchLighthouseBrowser(f.root, poison), /non-runnable/);
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "await import(" +
        JSON.stringify(
          pathToFileURL(
            fileURLToPath(
              new URL("./run-website-performance.mjs", import.meta.url),
            ),
          ).href,
        ) +
        ");",
    ],
    {
      encoding: "utf8",
      env: process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {},
    },
  );
  assert.equal(imported.status, 0);
  assert.equal(imported.stdout, "");
  assert.equal(imported.stderr, "");
  await assert.rejects(stat(path.join(f.root, "test-results")), {
    code: "ENOENT",
  });
});

test("Lighthouse and bundled browser dependencies require exact installed identities", async (t) => {
  const f = await fixture(t);
  const installed = await resolveLighthouseInstallation(f.root);
  assert.equal(installed.version, "13.6.0");
  assert.equal(installed.browserVersion, "156.0.8078.4");
  for (const [filename, value, pattern] of [
    [
      "package.json",
      {
        ...f.manifest,
        devDependencies: {
          ...f.manifest.devDependencies,
          lighthouse: "^13.6.0",
        },
      },
      /exact root/,
    ],
    ["package-lock.json", { ...f.lock, lockfileVersion: 2 }, /exact root/],
    [
      "node_modules/lighthouse/package.json",
      { ...f.installed, main: "./foreign.js" },
      /exact root/,
    ],
    [
      "node_modules/lighthouse/package.json",
      { ...f.installed, type: "commonjs" },
      /exact root/,
    ],
    [
      "node_modules/playwright-core/package.json",
      { ...f.core, version: "1.64.0" },
      /transitive packages/,
    ],
    [
      "node_modules/playwright-core/browsers.json",
      { browsers: [] },
      /reviewed Playwright/,
    ],
    [
      "node_modules/playwright-core/browsers.json",
      { browsers: [{ ...f.browsers.browsers[0], revision: "wrong" }] },
      /reviewed Playwright/,
    ],
  ]) {
    await f.put(filename, value);
    await assert.rejects(resolveLighthouseInstallation(f.root), pattern);
    await f.put("package.json", f.manifest);
    await f.put("package-lock.json", f.lock);
    await f.put("node_modules/lighthouse/package.json", f.installed);
    await f.put("node_modules/playwright-core/package.json", f.core);
    await f.put("node_modules/playwright-core/browsers.json", f.browsers);
  }
});

test("Lighthouse resolver rejects an exports redirect away from the reviewed root entry", async (t) => {
  const f = await fixture(t);
  await f.put(
    "node_modules/lighthouse/core/foreign.js",
    "// Unrelated synthetic entry.\n",
  );
  await f.put("node_modules/lighthouse/package.json", {
    ...f.installed,
    exports: "./core/foreign.js",
  });
  await assert.rejects(
    resolveLighthouseInstallation(f.root),
    /reviewed root-owned entry/,
  );
});

test("Lighthouse cannot borrow a parent installation when the selected root has none", async (t) => {
  const f = await fixture(t);
  await f.put("consumer/.github/bootstrap-policy.json", {
    schemaVersion: 1,
    applicationReady: true,
  });
  await f.put("consumer/package.json", f.manifest);
  await f.put("consumer/package-lock.json", f.lock);
  const root = path.join(f.root, "consumer");
  assert.equal(
    findPackageJSON("lighthouse", path.join(root, "package.json")),
    path.join(f.root, "node_modules/lighthouse/package.json"),
  );
  await assert.rejects(resolveLighthouseInstallation(root), { code: "ENOENT" });
  await assert.rejects(stat(path.join(root, ".lighthouseci")), {
    code: "ENOENT",
  });
});

test("Lighthouse rejects a linked entry before importing installed code", async (t) => {
  const f = await fixture(t);
  const core = path.join(f.root, "node_modules/lighthouse/core");
  await f.put(
    "owned-core/index.js",
    "throw new Error('Must never execute.');\n",
  );
  assert.equal(path.dirname(path.dirname(path.dirname(core))), f.root);
  await rm(core, { recursive: true });
  await symlink(path.join(f.root, "owned-core"), core, "junction");
  await assert.rejects(
    resolveLighthouseInstallation(f.root),
    /must not contain links/,
  );
});

test("twelve owned samples produce exact advisory medians and clean services in reverse order", async (t) => {
  const f = await fixture(t);
  const run = orchestration(f);
  const accepted = await runWebsitePerformance(f.root, run.options);
  assert.equal(accepted.samples, 12);
  assert.equal(accepted.advisory, true);
  assert.equal(run.trace.builds, 1);
  assert.deepEqual(run.trace.stops, ["website", "api"]);
  assert.equal(run.trace.samples.length, 12);
  assert.equal(run.trace.maximumConcurrentSamples, 1);
  assert.equal(run.trace.activeSamples, 0);
  assert.equal(run.trace.browserStarts, 12);
  assert.equal(run.trace.browserStops, 12);
  const summary = JSON.parse(
    await readFile(path.join(accepted.output, "summary.json"), "utf8"),
  );
  assert.equal(summary.results.length, 12);
  assert.deepEqual(
    summary.results.map(({ profile, route, run: sampleRun }) => [
      profile,
      route,
      sampleRun,
    ]),
    [
      ["mobile", "/", 1],
      ["mobile", "/", 2],
      ["mobile", "/", 3],
      ["mobile", "/login", 1],
      ["mobile", "/login", 2],
      ["mobile", "/login", 3],
      ["desktop", "/", 1],
      ["desktop", "/", 2],
      ["desktop", "/", 3],
      ["desktop", "/login", 1],
      ["desktop", "/login", 2],
      ["desktop", "/login", 3],
    ],
  );
  assert.equal(summary.summaries.length, 4);
  assert.deepEqual(
    summary.summaries,
    [
      ["mobile", "/"],
      ["mobile", "/login"],
      ["desktop", "/"],
      ["desktop", "/login"],
    ].map(([profile, route], group) => ({
      profile,
      route,
      score: 80,
      fcpMs: 300 + group * 1000,
      lcpMs: 500 + group * 1000,
      cls: 0.04 + group * 0.1,
      tbtMs: 30 + group * 1000,
      speedIndexMs: 700 + group * 1000,
    })),
  );
  assert.equal(summary.samplesPerProfileAndRoute, 3);
  assert.match(summary.mode, /advisory.*no deployment or field INP/);
  assert.equal((await readdir(accepted.output)).length, 26);
  const again = orchestration(f);
  const second = await runWebsitePerformance(f.root, {
    ...again.options,
    skipBuild: true,
  });
  assert.notEqual(second.output, accepted.output);
  assert.equal(again.trace.builds, 0);
  assert.equal(
    await readFile(path.join(accepted.output, "summary.json"), "utf8"),
    JSON.stringify(summary, null, 2) + "\n",
  );
});

test("cancellation between samples skips every later task and preserves completed reports", async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  const run = orchestration(f, { signal: controller.signal });
  const start = run.options.start;
  run.options.start = (options) => {
    const owned = start(options);
    if (run.trace.samples.length !== 2) return owned;
    return {
      ...owned,
      completion: owned.completion.then(() =>
        controller.abort(new Error("halt after second sample")),
      ),
    };
  };
  await assert.rejects(
    runWebsitePerformance(f.root, run.options),
    /halt after second sample/,
  );
  assert.equal(run.trace.samples.length, 2);
  assert.equal(run.trace.maximumConcurrentSamples, 1);
  assert.deepEqual([...run.trace.stops].sort(), ["api", "website"]);
  const [folder] = await readdir(
    path.join(f.root, "test-results/website-performance"),
  );
  assert.deepEqual(
    (
      await readdir(
        path.join(f.root, "test-results/website-performance", folder),
      )
    ).sort(),
    [
      "home-mobile-1.html",
      "home-mobile-1.json",
      "home-mobile-2.html",
      "home-mobile-2.json",
      "pending.json",
    ],
  );
});

test("sample failure drains services sequentially in reverse order and retains every cleanup failure", async (t) => {
  const f = await fixture(t);
  const stopped = [];
  let activeStops = 0;
  let maximumConcurrentStops = 0;
  const failOnStop =
    (name) =>
    async ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            stopped.push(name);
            activeStops++;
            maximumConcurrentStops = Math.max(
              maximumConcurrentStops,
              activeStops,
            );
            Promise.resolve().then(() => {
              activeStops--;
              reject(new Error(name + " cleanup failure"));
            });
          },
          { once: true },
        );
      });
  const payload = result();
  payload.lhr.runtimeError = { message: "synthetic failed first sample" };
  let samples = 0;
  const run = orchestration(f, {
    runApi: failOnStop("api"),
    runWebsite: failOnStop("website"),
    start: (options) => {
      samples++;
      return startOwnedProcess({
        ...options,
        args: [
          "--input-type=module",
          "-e",
          "process.stdout.write(" +
            JSON.stringify(JSON.stringify(payload)) +
            ")",
        ],
      });
    },
  });
  const messages = (error) =>
    error instanceof AggregateError
      ? error.errors.flatMap(messages)
      : [error.message];
  await assert.rejects(runWebsitePerformance(f.root, run.options), (error) => {
    assert.deepEqual(messages(error), [
      "Lighthouse reported a runtime failure.",
      "website cleanup failure",
      "api cleanup failure",
    ]);
    return true;
  });
  assert.equal(samples, 1);
  assert.deepEqual(stopped, ["website", "api"]);
  assert.equal(maximumConcurrentStops, 1);
  assert.equal(activeStops, 0);
  const [folder] = await readdir(
    path.join(f.root, "test-results/website-performance"),
  );
  assert.deepEqual(
    await readdir(
      path.join(f.root, "test-results/website-performance", folder),
    ),
    ["pending.json"],
  );
});

test("invalid selections, unavailable ports, bundle overflow and linked outputs cannot launch services", async (t) => {
  const f = await fixture(t);
  for (const invalid of [
    { signal: {} },
    { skipBuild: "yes" },
    { maximumOutputBytes: 0 },
    { maximumOutputBytes: 20 * 1024 * 1024 + 1 },
  ]) {
    const run = orchestration(f);
    await assert.rejects(
      runWebsitePerformance(f.root, { ...run.options, ...invalid }),
      /AbortSignal|explicit boolean|output limit/,
    );
    assert.deepEqual(run.trace.starts, []);
  }
  const aborted = new AbortController();
  aborted.abort(new Error("cancelled before launch"));
  await assert.rejects(
    runWebsitePerformance(f.root, { signal: aborted.signal }),
    /cancelled before launch/,
  );
  const ports = orchestration(f, {
    ports: async () => {
      throw new Error("owned port is occupied");
    },
  });
  await assert.rejects(
    runWebsitePerformance(f.root, ports.options),
    /occupied/,
  );
  assert.deepEqual(ports.trace.starts, []);
  const overflow = orchestration(f, {
    measureBundle: async () => ({ ...bundle(), javaScriptBytes: 101 }),
  });
  await assert.rejects(
    runWebsitePerformance(f.root, overflow.options),
    /exceeds/,
  );
  assert.deepEqual(overflow.trace.starts, []);
  const target = path.join(f.root, "owned-output-target");
  await f.put("owned-output-target/keep.txt", "unrelated owned fixture");
  await mkdir(path.join(f.root, "test-results"));
  await symlink(
    target,
    path.join(f.root, "test-results/website-performance"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = orchestration(f);
  await assert.rejects(runWebsitePerformance(f.root, linked.options), /link/);
  assert.deepEqual(linked.trace.starts, []);
  assert.equal(
    await readFile(path.join(target, "keep.txt"), "utf8"),
    "unrelated owned fixture",
  );
});

test("an alternate default worker root is refused before build, inputs or services", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    runWebsitePerformance(f.root, {
      get environment() {
        throw new Error("Inputs must remain unread.");
      },
      get build() {
        throw new Error("A different root must never be built.");
      },
    }),
    /actual owner repository before preparation/,
  );
  await assert.rejects(stat(path.join(f.root, "test-results")), {
    code: "ENOENT",
  });
});

test("parent browser launch retains one process handle with a filtered loopback-only environment", async (t) => {
  const f = await fixture(t);
  let launches = 0;
  let kills = 0;
  const modules = async () => ({
    chromium: {
      executablePath: () => f.executable,
      launchServer: async (options) => {
        launches++;
        assert.equal(options.host, "127.0.0.1");
        assert.equal(options.channel, "chromium");
        assert.equal(options.executablePath, f.executable);
        assert.equal(options.env.NODE_OPTIONS, undefined);
        assert.equal(options.env.TOKEN, undefined);
        assert.equal(options.env.PLAYWRIGHT_BROWSERS_PATH, "0");
        assert.ok(options.args.includes("--remote-debugging-port=43223"));
        return {
          process: () => ({ pid: 123 }),
          wsEndpoint: () => browserConnection.endpoint,
          kill: async () => {
            kills++;
          },
        };
      },
    },
  });
  const browser = await launchLighthouseBrowser(f.root, {
    environment: f.environment,
    modules,
    port: async () => 43223,
  });
  assert.equal(launches, 1);
  assert.equal(kills, 0);
  await Promise.all([browser.stop(), browser.stop()]);
  assert.equal(kills, 1);
  await assert.rejects(
    launchLighthouseBrowser(f.root, {
      environment: f.environment,
      modules,
      port: async () => 0,
    }),
    /explicit loopback CDP port/,
  );
  assert.equal(launches, 1);
});

test("parent refuses cached global, custom and linked Chromium executables before any launch", async (t) => {
  const f = await fixture(t);
  let launches = 0;
  const attempt = (selected) =>
    launchLighthouseBrowser(f.root, {
      environment: { ...f.environment, PLAYWRIGHT_BROWSERS_PATH: "0" },
      modules: async () => ({
        chromium: {
          executablePath: () => selected,
          launchServer: async () => {
            launches++;
            throw new Error("No unreviewed browser may start.");
          },
        },
      }),
      port: async () => 43223,
    });
  for (const relative of [
    "synthetic-global-cache/chromium-1248/chrome.exe",
    "custom-browser/chrome.exe",
  ]) {
    await f.put(relative, "Owned inert foreign executable fixture.\n");
    await assert.rejects(
      attempt(path.join(f.root, relative)),
      /reviewed root-local Chromium/,
    );
  }
  const browserDirectory = path.join(
    f.root,
    "node_modules/playwright-core/.local-browsers/chromium-1248",
  );
  assert.ok(browserDirectory.startsWith(f.root + path.sep));
  await f.put(
    "owned-browser-link-target/keep.txt",
    "Owned target must remain untouched.",
  );
  await rm(browserDirectory, { recursive: true });
  await symlink(
    path.join(f.root, "owned-browser-link-target"),
    browserDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(attempt(f.executable), /must not contain links/);
  assert.equal(
    await readFile(
      path.join(f.root, "owned-browser-link-target/keep.txt"),
      "utf8",
    ),
    "Owned target must remain untouched.",
  );
  assert.equal(launches, 0);
});

test("parent teardown survives worker termination, cancellation and a controlled execution deadline", async (t) => {
  await Promise.all(
    ["terminated", "cancelled", "deadline"].map((mode) =>
      t.test(mode, async (t_) => {
        const f = await fixture(t_);
        const controller = new AbortController();
        const children = [];
        const closes = [];
        const owned = (name, args, signal) => {
          const child = startOwnedProcess({
            args,
            cwd: f.root,
            env: process.env.SystemRoot
              ? { SystemRoot: process.env.SystemRoot }
              : {},
            signal,
            stdio: ["ignore", "pipe", "inherit", "ipc"],
          });
          children.push(child);
          child.child.once("close", () => closes.push(name));
          return child;
        };
        t_.after(async () => {
          await Promise.all(children.map((child) => child.stop()));
        });
        if (mode === "deadline")
          t_.mock.timers.enable({ apis: ["setTimeout"] });
        const program =
          "import{createServer}from'node:net';createServer().listen(0,'127.0.0.1',()=>process.send('ready'));";
        let kills = 0;
        const run = orchestration(f, {
          signal: controller.signal,
          launchBrowser: () =>
            launchLighthouseBrowser(f.root, {
              environment: f.environment,
              port: async () => 43223,
              modules: async () => ({
                chromium: {
                  executablePath: () => f.executable,
                  launchServer: async () => {
                    const child = owned("browser", [
                      "--input-type=module",
                      "-e",
                      program,
                    ]);
                    await Promise.race([
                      once(child.child, "message"),
                      child.completion.then(() => {
                        throw new Error("Browser exited before readiness.");
                      }),
                    ]);
                    return {
                      process: () => child.child,
                      wsEndpoint: () => browserConnection.endpoint,
                      close: () => {
                        throw new Error(
                          "A hung browser protocol must not control cleanup.",
                        );
                      },
                      kill: async () => {
                        kills++;
                        await child.stop();
                      },
                    };
                  },
                },
              }),
            }),
          start: (options) => {
            const child = owned(
              "worker",
              ["--input-type=module", "-e", program],
              options.signal,
            );
            child.child.once("message", () => {
              if (mode === "terminated") child.child.kill("SIGKILL");
              else if (mode === "cancelled")
                controller.abort(new Error("cancelled at worker readiness"));
              else t_.mock.timers.tick(180_000);
            });
            return child;
          },
        });
        await assert.rejects(
          runWebsitePerformance(f.root, run.options),
          /signal|aborted|execution deadline/,
        );
        assert.equal(kills, 1);
        assert.deepEqual(closes.sort(), ["browser", "worker"]);
        assert.ok(
          children.every(
            (child) =>
              child.child.exitCode !== null || child.child.signalCode !== null,
          ),
        );
        assert.deepEqual([...run.trace.stops].sort(), ["api", "website"]);
      }),
    ),
  );
});

test("browser ownership failures still attempt cleanup and retain its independent failure", async (t) => {
  const f = await fixture(t);
  const cleanup = new Error("Owned browser kill failed.");
  await assert.rejects(
    launchLighthouseBrowser(f.root, {
      environment: f.environment,
      port: async () => 43223,
      modules: async () => ({
        chromium: {
          executablePath: () => f.executable,
          launchServer: async () => ({
            process: () => ({ pid: undefined }),
            kill: async () => {
              throw cleanup;
            },
          }),
        },
      }),
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(
        error.errors[0].message,
        /independently owned browser process/,
      );
      assert.equal(error.errors[1], cleanup);
      return true;
    },
  );
  const first = new Error("Worker failed before returning a handle.");
  const run = orchestration(f, {
    launchBrowser: async () => ({
      ...browserConnection,
      stop: async () => {
        throw cleanup;
      },
    }),
    start: () => {
      throw first;
    },
  });
  await assert.rejects(runWebsitePerformance(f.root, run.options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, cleanup]);
    return true;
  });
  assert.deepEqual(run.trace.stops, ["website", "api"]);
});

test("invalid reports fail and retain only pending evidence while draining all owned services", async (t) => {
  const f = await fixture(t);
  const invalid = [];
  const runtime = result();
  runtime.lhr.runtimeError = { message: "synthetic runtime failure" };
  invalid.push(runtime);
  const version = result();
  version.lhr.lighthouseVersion = "unowned";
  invalid.push(version);
  const report = result();
  report.report[0] = null;
  invalid.push(report);
  const score = result();
  score.lhr.categories.performance.score = null;
  invalid.push(score);
  const redirected = result();
  redirected.lhr.finalDisplayedUrl = "https://foreign.test";
  invalid.push(redirected);
  const wrongRoute = result();
  wrongRoute.lhr.finalDisplayedUrl = origin + "/login";
  invalid.push(wrongRoute);
  const requests = result();
  requests.lhr.audits["network-requests"].details.items.push({
    url: "https://foreign.test",
  });
  invalid.push(requests);
  const missing = result();
  missing.lhr.audits["network-requests"] = {};
  invalid.push(missing);
  const metric = result();
  metric.lhr.audits["first-contentful-paint"].numericValue = -1;
  invalid.push(metric);
  const json = result();
  json.report[1] = "not-json";
  invalid.push(json);
  for (const payload of invalid) {
    const run = orchestration(f, {
      start: (options) =>
        startOwnedProcess({
          ...options,
          args: [
            "--input-type=module",
            "-e",
            "process.stdout.write(" +
              JSON.stringify(JSON.stringify(payload)) +
              ")",
          ],
        }),
    });
    await assert.rejects(
      runWebsitePerformance(f.root, run.options),
      /Lighthouse|JSON|Unexpected/,
    );
    assert.deepEqual(run.trace.stops, ["website", "api"]);
  }
  const folders = await readdir(
    path.join(f.root, "test-results/website-performance"),
  );
  for (const folder of folders)
    assert.deepEqual(
      await readdir(
        path.join(f.root, "test-results/website-performance", folder),
      ),
      ["pending.json"],
    );
});

test("bounded child output, nonzero child exit and cancellation preserve the first failure", async (t) => {
  const f = await fixture(t);
  for (const [program, extra, pattern] of [
    [
      "import{createServer}from'node:net';createServer().listen(0,'127.0.0.1');process.stdout.write('x'.repeat(1024));",
      { maximumOutputBytes: 32 },
      /bounded output/,
    ],
    ["process.exitCode=9;", {}, /code 9/],
    ["process.stdout.write('not-json');", {}, /JSON|Unexpected/],
  ]) {
    const run = orchestration(f, {
      ...extra,
      start: (options) =>
        startOwnedProcess({
          ...options,
          args: ["--input-type=module", "-e", program],
        }),
    });
    await assert.rejects(runWebsitePerformance(f.root, run.options), pattern);
    assert.deepEqual(run.trace.stops, ["website", "api"]);
  }
  const controller = new AbortController();
  const cancellation = orchestration(f, {
    signal: controller.signal,
    start: (options) => {
      const owned = startOwnedProcess({
        ...options,
        args: [
          "--input-type=module",
          "-e",
          "import{createServer}from'node:net';createServer().listen(0,'127.0.0.1');",
        ],
      });
      owned.child.once("spawn", () =>
        controller.abort(new Error("cancelled during sample")),
      );
      return owned;
    },
  });
  await assert.rejects(
    runWebsitePerformance(f.root, cancellation.options),
    /aborted|cancelled/,
  );
  assert.deepEqual([...cancellation.trace.stops].sort(), ["api", "website"]);
});

test("service readiness and cleanup failures cannot masquerade as successful sampling", async (t) => {
  const f = await fixture(t);
  const exited = orchestration(f, {
    runApi: async () => {},
    ready: async (_url, service) => {
      await service.completion;
      service.assertAlive();
    },
  });
  await assert.rejects(
    runWebsitePerformance(f.root, exited.options),
    /exited|no longer/,
  );
  const failed = orchestration(f, {
    runApi: async () => {
      throw new Error("API failed before readiness");
    },
    ready: async (_url, service) => {
      await service.completion;
      service.assertAlive();
    },
  });
  await assert.rejects(
    runWebsitePerformance(f.root, failed.options),
    /cleanup failed|API failed/,
  );
  const ready = orchestration(f, {
    ready: async () => {
      throw new Error("readiness failed");
    },
  });
  await assert.rejects(
    runWebsitePerformance(f.root, ready.options),
    /readiness failed/,
  );
  assert.deepEqual(ready.trace.stops, ["api"]);
  const cleanup = orchestration(f, {
    runWebsite: async ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("website drain failure")),
          { once: true },
        );
      }),
  });
  await assert.rejects(
    runWebsitePerformance(f.root, cleanup.options),
    /website drain failure/,
  );
});

function browserModules(payload = result(), errors = {}) {
  const calls = { closed: 0, pageClosed: 0, lighthouse: [], connect: [] };
  const browser = {
    version: () => errors.version ?? "156.0.8078.4",
    newPage: async () => ({
      context: () => ({
        newCDPSession: async () => ({
          send: async () => ({ targetInfo: { targetId: "owned-target" } }),
        }),
      }),
      close: async () => {
        calls.pageClosed++;
      },
    }),
    close: async () => {
      calls.closed++;
      if (errors.close) throw new Error("browser drain failure");
    },
  };
  const modules = async () => ({
    desktop: { settings: { formFactor: "desktop" } },
    chromium: {
      connect: async (endpoint) => {
        calls.connect.push(endpoint);
        return browser;
      },
    },
    lighthouse: async (...args) => {
      calls.lighthouse.push(args);
      if (errors.sample) throw new Error("sample failure");
      return payload;
    },
  });
  return { calls, modules };
}

test("default sample imports cannot select another ready repository's dependencies", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    runLighthouseSample(f.root, "mobile", "/", {
      environment: f.environment,
      installation: () => {
        throw new Error(
          "An injected installation cannot authorize real imports.",
        );
      },
      port: () => {
        throw new Error(
          "No browser port may be selected before owner validation.",
        );
      },
    }),
    /actual owner repository/,
  );
});

test("sample worker verifies the parent-owned browser and disconnects after mobile/desktop runs", async (t) => {
  const f = await fixture(t);
  for (const profile of ["mobile", "desktop"]) {
    const fake = browserModules();
    const actual = await runLighthouseSample(f.root, profile, "/", {
      environment: f.environment,
      browser: browserConnection,
      modules: fake.modules,
      fetch: async (_url, options) => {
        assert.equal(options.redirect, "error");
        return { ok: true, json: async () => [{ id: "owned-target" }] };
      },
    });
    assert.equal(actual.lhr.lighthouseVersion, "13.6.0");
    assert.equal(fake.calls.closed, 1);
    assert.equal(fake.calls.pageClosed, 1);
    assert.deepEqual(fake.calls.connect, [browserConnection.endpoint]);
    assert.equal(fake.calls.lighthouse[0][1].hostname, "127.0.0.1");
    assert.deepEqual(fake.calls.lighthouse[0][1].output, ["html", "json"]);
    assert.equal(
      fake.calls.lighthouse[0][2]?.settings.formFactor,
      profile === "desktop" ? "desktop" : undefined,
    );
  }
});

test("sample workers reject non-loopback, noncanonical and out-of-range parent connections before SDK access", async (t) => {
  const f = await fixture(t);
  for (const browser of [
    undefined,
    { ...browserConnection, port: 0 },
    { ...browserConnection, port: 65536 },
    { ...browserConnection, endpoint: "ws://foreign.test:43224/owned-browser" },
    {
      ...browserConnection,
      endpoint: "ws://127.0.0.1:43224/owned-browser?target=other",
    },
    { ...browserConnection, endpoint: "ws://127.1:43224/owned-browser" },
    {
      ...browserConnection,
      endpoint: "ws://127.0.0.1:43224/" + "x".repeat(513),
    },
    { ...browserConnection, endpoint: new URL(browserConnection.endpoint) },
  ]) {
    const fake = browserModules();
    await assert.rejects(
      runLighthouseSample(f.root, "mobile", "/", {
        environment: f.environment,
        browser,
        modules: fake.modules,
      }),
      /owned loopback browser/,
    );
    assert.deepEqual(fake.calls.connect, []);
  }
});

test("sample worker serializes only reports without reading raw Lighthouse artifacts", async (t) => {
  const f = await fixture(t);
  const payload = result();
  let artifactReads = 0;
  Object.defineProperty(payload, "artifacts", {
    enumerable: true,
    get() {
      artifactReads++;
      throw new Error("Raw Lighthouse traces must not enter worker stdout.");
    },
  });
  const fake = browserModules(payload);
  const actual = await runLighthouseSample(f.root, "mobile", "/", {
    environment: f.environment,
    browser: browserConnection,
    modules: fake.modules,
    fetch: async () => ({
      ok: true,
      json: async () => [{ id: "owned-target" }],
    }),
    port: async () => 43223,
  });
  const serialized = JSON.stringify(actual);
  assert.equal(artifactReads, 0);
  assert.deepEqual(JSON.parse(serialized), {
    lhr: payload.lhr,
    report: payload.report,
  });
  assert.equal(fake.calls.closed, 1);
});

test("worker rejects unowned browser/CDP, invalid report and cleanup failures", async (t) => {
  const f = await fixture(t);
  for (const [payload, errors, fetch_, pattern] of [
    [result(), { version: "wrong" }, undefined, /unexpected bundled/],
    [
      result(),
      {},
      async () => ({ ok: true, json: async () => [{ id: "foreign" }] }),
      /not owned/,
    ],
    [result(), { sample: true }, undefined, /sample failure/],
    [
      result(),
      { sample: true, close: true },
      undefined,
      /sample and browser cleanup failed/,
    ],
    [result(), { close: true }, undefined, /browser drain failure/],
    [
      { ...result(), report: ["x".repeat(8 * 1024 * 1024 + 1), "{}"] },
      {},
      undefined,
      /bounded HTML/,
    ],
  ]) {
    const fake = browserModules(payload, errors);
    await assert.rejects(
      runLighthouseSample(f.root, "mobile", "/", {
        environment: f.environment,
        browser: browserConnection,
        modules: fake.modules,
        fetch:
          fetch_ ??
          (async () => ({
            ok: true,
            json: async () => [{ id: "owned-target" }],
          })),
        port: async () => 43223,
      }),
      pattern,
    );
    assert.equal(fake.calls.closed, 1);
  }
  await assert.rejects(
    runLighthouseSample(f.root, "tablet", "/", {}),
    /declared profile/,
  );
  await assert.rejects(
    runLighthouseSample(f.root, "mobile", "/private", {}),
    /declared profile/,
  );
});
