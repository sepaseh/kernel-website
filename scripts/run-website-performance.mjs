import { lstat, mkdtemp, open } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { runApplicationCheck } from "./application-checks.mjs";
import {
  resolvePlaywrightInstallation,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import {
  evaluateWebsiteBudget,
  measureWebsiteBundle,
} from "./check-bundle-website.mjs";
import {
  artifactFile,
  completeArtifactWork,
  ensureArtifactDirectory,
  readArtifactFile,
} from "./release-files.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import { runVerificationCli, startOwnedProcess } from "./runner-process.mjs";
import { runWebsiteApi } from "./test-website-api.mjs";
import { runTestWebsiteServer } from "./test-website-server.mjs";
import { assertVisualPortsAvailable } from "./visual-environment.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(import.meta.url);
const reportLimit = 8 * 1024 * 1024;
const sampleLimit = 20 * 1024 * 1024;
const metrics = {
  fcpMs: "first-contentful-paint",
  lcpMs: "largest-contentful-paint",
  cls: "cumulative-layout-shift",
  tbtMs: "total-blocking-time",
  speedIndexMs: "speed-index",
};
const readJson = async (filename) =>
  JSON.parse((await readArtifactFile(filename)).toString("utf8"));

/** Resolve exact root-owned Lighthouse and Chromium identities before execution. */
export async function resolveLighthouseInstallation(root) {
  const directory = await readyRunnerRoot(root);
  const [manifest, lock, installed, core, browsers] = await Promise.all([
    readJson(path.join(directory, "package.json")),
    readJson(path.join(directory, "package-lock.json")),
    readJson(path.join(directory, "node_modules/lighthouse/package.json")),
    readJson(path.join(directory, "node_modules/playwright-core/package.json")),
    readJson(
      path.join(directory, "node_modules/playwright-core/browsers.json"),
    ),
  ]);
  const version = manifest.devDependencies?.lighthouse;
  if (
    manifest.name !== "kernel-website" ||
    !/^\d+\.\d+\.\d+$/.test(version ?? "") ||
    lock.lockfileVersion !== 3 ||
    lock.packages?.[""]?.devDependencies?.lighthouse !== version ||
    lock.packages?.["node_modules/lighthouse"]?.version !== version ||
    installed.name !== "lighthouse" ||
    installed.version !== version ||
    installed.main !== "./core/index.js"
  )
    throw new Error(
      "Lighthouse must match the exact root manifest, lock and installation.",
    );
  const require = createRequire(path.join(directory, "package.json"));
  const lighthouse = await artifactFile(require.resolve("lighthouse"));
  const expectedEntry = await artifactFile(
    path.join(directory, "node_modules/lighthouse/core/index.js"),
  );
  if (lighthouse !== expectedEntry)
    throw new Error(
      "Lighthouse must resolve to its reviewed root-owned entry.",
    );
  const playwright = await resolvePlaywrightInstallation(directory);
  const chromium = browsers.browsers?.find(
    (browser) => browser.name === "chromium",
  );
  if (
    playwright.version !== "1.64.1" ||
    core.name !== "playwright-core" ||
    core.version !== playwright.version ||
    lock.packages?.["node_modules/playwright-core"]?.version !==
      playwright.version ||
    chromium?.revision !== "1248" ||
    chromium.browserVersion !== "156.0.8078.4"
  )
    throw new Error(
      "Lighthouse requires the reviewed Playwright 1.64.1 Chromium identity.",
    );
  return {
    version,
    browserVersion: chromium.browserVersion,
    playwright: playwright.module,
    lighthouse,
    desktop: await artifactFile(
      path.join(
        directory,
        "node_modules/lighthouse/core/config/lr-desktop-config.js",
      ),
    ),
  };
}

function selectedSample(profile, route) {
  if (
    !["mobile", "desktop"].includes(profile) ||
    !["/", "/login"].includes(route)
  )
    throw new Error("Lighthouse samples require a declared profile and route.");
}

function sampleResult(result, version, origin, route) {
  if (result?.lhr?.runtimeError)
    throw new Error("Lighthouse reported a runtime failure.");
  const lhr = result?.lhr;
  if (
    !lhr ||
    lhr.lighthouseVersion !== version ||
    !Array.isArray(result.report) ||
    result.report.length !== 2 ||
    result.report.some(
      (report) =>
        typeof report !== "string" || Buffer.byteLength(report) > reportLimit,
    )
  )
    throw new Error(
      "Lighthouse must produce bounded HTML/JSON reports for its exact version.",
    );
  const score = lhr.categories?.performance?.score;
  if (!Number.isFinite(score) || score < 0 || score > 1)
    throw new Error("Lighthouse performance score is unavailable.");
  if (
    !["requestedUrl", "finalDisplayedUrl"].every((key) => {
      try {
        return new URL(lhr[key]).origin === origin;
      } catch {
        return false;
      }
    })
  )
    throw new Error("Lighthouse must stay on the owned website origin.");
  if (
    ["requestedUrl", "finalDisplayedUrl"].some(
      (key) => lhr[key] !== origin + route,
    )
  )
    throw new Error(
      "Lighthouse must measure the declared route without redirects.",
    );
  const requests = lhr.audits?.["network-requests"]?.details?.items;
  if (
    !Array.isArray(requests) ||
    requests.some(
      (item) =>
        typeof item.url !== "string" ||
        (/^https?:/i.test(item.url) && new URL(item.url).origin !== origin),
    )
  )
    throw new Error("Lighthouse observed an external application request.");
  const values = Object.fromEntries(
    Object.entries(metrics).map(([name, id]) => {
      const value = lhr.audits?.[id]?.numericValue;
      if (!Number.isFinite(value) || value < 0)
        throw new Error("A required Lighthouse metric is unavailable.");
      return [name, value];
    }),
  );
  JSON.parse(result.report[1]);
  return { score: Math.round(score * 100), ...values };
}

async function availablePort() {
  const server = net.createServer();
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

async function boundedClose(browser) {
  let timer;
  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(
          () =>
            reject(
              new Error(
                "Owned Lighthouse browser did not close within its deadline.",
              ),
            ),
          5000,
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/** Run one sample in a filtered worker and bind CDP to its own bundled browser. */
export async function runLighthouseSample(root, profile, route, options = {}) {
  const directory = await readyRunnerRoot(root);
  selectedSample(profile, route);
  const inputs = await (options.inputs ?? syntheticBrowserInputs)(
    directory,
    options.environment ?? process.env,
  );
  const installation = await (
    options.installation ?? resolveLighthouseInstallation
  )(directory);
  const modules =
    options.modules ??
    (async () => {
      const [{ default: lighthouse }, { chromium }, { default: desktop }] =
        await Promise.all([
          import(pathToFileURL(installation.lighthouse).href),
          import(pathToFileURL(installation.playwright).href),
          import(pathToFileURL(installation.desktop).href),
        ]);
      return { lighthouse, chromium, desktop };
    });
  const { lighthouse, chromium, desktop } = await modules();
  const port = await (options.port ?? availablePort)();
  const environment = {
    ...inputs.websiteEnvironment,
    PLAYWRIGHT_BROWSERS_PATH: "0",
  };
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
    env: environment,
    args: [
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=" + port,
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
      "--no-proxy-server",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    ],
  });
  let result;
  let failure;
  try {
    if (browser.version() !== installation.browserVersion)
      throw new Error(
        "Lighthouse launched an unexpected bundled Chromium version.",
      );
    const page = await browser.newPage();
    const session = await page.context().newCDPSession(page);
    const { targetInfo } = await session.send("Target.getTargetInfo");
    const response = await (options.fetch ?? fetch)(
      "http://127.0.0.1:" + port + "/json/list",
      { redirect: "error", signal: AbortSignal.timeout(5000) },
    );
    const targets = await response.json();
    if (
      !response.ok ||
      !Array.isArray(targets) ||
      !targets.some((target) => target.id === targetInfo.targetId)
    )
      throw new Error(
        "Lighthouse CDP endpoint is not owned by its launched browser.",
      );
    await page.close();
    result = await lighthouse(
      inputs.websiteOrigin + route,
      {
        hostname: "127.0.0.1",
        port,
        logLevel: "error",
        onlyCategories: ["performance"],
        output: ["html", "json"],
        locale: "en-US",
        maxWaitForLoad: 45_000,
      },
      profile === "desktop" ? desktop : undefined,
    );
    sampleResult(result, installation.version, inputs.websiteOrigin, route);
  } catch (error) {
    failure = error;
  }
  try {
    await boundedClose(browser);
  } catch (error) {
    failure = failure
      ? new AggregateError(
          [failure, error],
          "Lighthouse sample and browser cleanup failed.",
        )
      : error;
  }
  if (failure) throw failure;
  return result;
}

function ownedService(name, action, inputs, parentSignal) {
  const controller = new AbortController();
  const signal = parentSignal
    ? AbortSignal.any([parentSignal, controller.signal])
    : controller.signal;
  let finished = false;
  let failure;
  let stopping = false;
  let failureReported = false;
  const completion = Promise.resolve()
    .then(() => action({ ...inputs, signal }))
    .then(
      () => {
        finished = true;
        if (!stopping && !signal.aborted)
          failure = new Error(
            "Owned " + name + " exited before sampling completed.",
          );
      },
      (error) => {
        finished = true;
        if (!(signal.aborted && error.message === "Owned process was aborted."))
          failure = error;
      },
    );
  return {
    assertAlive() {
      if (failure) {
        failureReported = true;
        throw failure;
      }
      if (finished) throw new Error("Owned " + name + " is no longer running.");
    },
    async stop() {
      stopping = true;
      controller.abort();
      await completion;
      if (failure && !failureReported) throw failure;
    },
  };
}

async function readyService(url, service, signal) {
  const deadline = Date.now() + 60_000;
  const attempt = async () => {
    if (Date.now() >= deadline)
      throw new Error("Owned Lighthouse service did not become ready.");
    signal?.throwIfAborted();
    service.assertAlive();
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(1000),
        ]),
      });
      const ok = response.ok;
      await response.body?.cancel();
      if (ok) {
        service.assertAlive();
        return;
      }
    } catch {
      signal?.throwIfAborted();
      service.assertAlive();
    }
    await setTimeout(100, undefined, { signal });
    return attempt();
  };
  return attempt();
}

async function writeReport(directory, filename, value) {
  const output = await open(path.join(directory, filename), "wx", 0o600);
  const identity = await output.stat();
  try {
    await output.writeFile(value);
    const current = await lstat(
      await artifactFile(path.join(directory, filename)),
    );
    if (current.dev !== identity.dev || current.ino !== identity.ino)
      throw new Error("Owned Lighthouse report was replaced.");
  } finally {
    await output.close();
  }
}

async function captureSample(
  start,
  directory,
  environment,
  profile,
  route,
  signal,
  limit,
) {
  const owned = start({
    args: [script, "--sample", profile, route],
    cwd: directory,
    env: environment,
    signal,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const chunks = [];
  const capture = async () => {
    let bytes = 0;
    for await (const chunk of owned.child.stdout) {
      bytes += chunk.length;
      if (bytes > limit)
        throw new Error("Lighthouse child report exceeded its bounded output.");
      chunks.push(chunk);
    }
  };
  let timer;
  try {
    const deadline = new Promise((_, reject) => {
      timer = globalThis.setTimeout(
        () =>
          reject(
            new Error("Lighthouse sample exceeded its execution deadline."),
          ),
        180_000,
      );
    });
    await Promise.race([Promise.all([owned.completion, capture()]), deadline]);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    try {
      await owned.stop();
    } catch (stopError) {
      throw new AggregateError(
        [error, stopError],
        "Lighthouse sample and child cleanup failed.",
        { cause: stopError },
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

const median = (values) =>
  [...values].sort((left, right) => left - right)[
    Math.floor(values.length / 2)
  ];

const samplePlan = ["mobile", "desktop"].flatMap((profile) =>
  ["/", "/login"].flatMap((route) =>
    [1, 2, 3].map((run) => ({ profile, route, run })),
  ),
);

async function captureAndPersistSample(context, sample) {
  const { directory, inputs, installation, services, options, environment } =
    context;
  const { profile, route, run } = sample;
  options.signal?.throwIfAborted();
  services.forEach((service) => service.assertAlive());
  const result = await captureSample(
    options.start ?? startOwnedProcess,
    directory,
    environment,
    profile,
    route,
    options.signal,
    options.maximumOutputBytes,
  );
  const values = sampleResult(
    result,
    installation.version,
    inputs.websiteOrigin,
    route,
  );
  const name = (route === "/" ? "home" : "login") + "-" + profile + "-" + run;
  await completeArtifactWork([
    writeReport(options.output, name + ".html", result.report[0]),
    writeReport(options.output, name + ".json", result.report[1]),
  ]);
  return { profile, route, run, ...values };
}

async function gatherSamples(
  directory,
  inputs,
  installation,
  services,
  options,
) {
  const environment = {
    ...inputs.websiteEnvironment,
    KERNEL_API_DIRECTORY: inputs.apiDirectory,
    PLAYWRIGHT_BROWSERS_PATH: "0",
  };
  const context = {
    directory,
    inputs,
    installation,
    services,
    options,
    environment,
  };
  return samplePlan.reduce(
    (previous, sample) =>
      previous.then(async (results) => [
        ...results,
        await captureAndPersistSample(context, sample),
      ]),
    Promise.resolve([]),
  );
}

function summarizeSamples(results) {
  return ["mobile", "desktop"].flatMap((profile) =>
    ["/", "/login"].map((route) => {
      const samples = results.filter(
        (result) => result.profile === profile && result.route === route,
      );
      return {
        profile,
        route,
        ...Object.fromEntries(
          ["score", ...Object.keys(metrics)].map((key) => [
            key,
            median(samples.map((sample) => sample[key])),
          ]),
        ),
      };
    }),
  );
}

async function drainServices(services, originalFailure) {
  return [...services].reverse().reduce(
    (previous, service) =>
      previous.then(async (failure) => {
        try {
          await service.stop();
          return failure;
        } catch (error) {
          return failure
            ? new AggregateError(
                [failure, error],
                "Lighthouse run and owned service cleanup failed.",
              )
            : error;
        }
      }),
    Promise.resolve(originalFailure),
  );
}

/** Produce twelve isolated local lab samples and advisory medians, never a deployment gate. */
export async function runWebsitePerformance(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Lighthouse cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const skipBuild = options.skipBuild ?? false;
  const limit = options.maximumOutputBytes ?? sampleLimit;
  if (typeof skipBuild !== "boolean")
    throw new Error("Lighthouse skipBuild must be an explicit boolean.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > sampleLimit)
    throw new Error("Lighthouse output limit must be between1byte and20MiB.");
  const inputs = await (options.inputs ?? syntheticBrowserInputs)(
    directory,
    options.environment ?? process.env,
  );
  const installation = await (
    options.installation ?? resolveLighthouseInstallation
  )(directory);
  await (options.ports ?? assertVisualPortsAvailable)([
    Number(new URL(inputs.websiteOrigin).port),
    Number(new URL(inputs.apiOrigin).port),
  ]);
  if (!skipBuild)
    await (
      options.build ??
      ((root_, environment, signal_) =>
        runApplicationCheck(root_, "build", { environment, signal: signal_ }))
    )(directory, inputs.websiteEnvironment, signal);
  const bundle = await (options.measureBundle ?? measureWebsiteBundle)(
    path.join(directory, ".next"),
  );
  const budget = await readJson(
    path.join(directory, "performance-budget.json"),
  );
  const failures = evaluateWebsiteBudget(bundle, budget);
  if (failures.length) throw new Error(failures.join("\n"));
  const parent = await ensureArtifactDirectory(
    path.join(directory, ".lighthouseci/website"),
  );
  const output = await mkdtemp(path.join(parent, "lab-"));
  await writeReport(
    output,
    "pending.json",
    JSON.stringify({ mode: "advisory", samplesRequired: 12 }) + "\n",
  );
  const services = [];
  let results = [];
  let summary;
  let failure;
  try {
    const api = ownedService(
      "API fixture",
      options.runApi ??
        (({ root: root_, environment, signal: signal_ }) =>
          runWebsiteApi({
            root: root_,
            inherited: environment,
            signal: signal_,
          })),
      { root: directory, environment: inputs.websiteEnvironment },
      signal,
    );
    services.push(api);
    await (options.ready ?? readyService)(
      inputs.apiOrigin + "/health",
      api,
      signal,
    );
    const server = ownedService(
      "website",
      options.runWebsite ??
        (({ root: root_, environment, signal: signal_ }) =>
          runTestWebsiteServer(root_, {
            environment,
            signal: signal_,
            skipBuild: true,
          })),
      { root: directory, environment: inputs.websiteEnvironment },
      signal,
    );
    services.push(server);
    await (options.ready ?? readyService)(
      inputs.websiteOrigin + "/login",
      server,
      signal,
    );
    results = await gatherSamples(directory, inputs, installation, services, {
      ...options,
      signal,
      maximumOutputBytes: limit,
      output,
    });
    signal?.throwIfAborted();
    summary =
      JSON.stringify(
        {
          mode: "advisory local production lab; no deployment or field INP",
          generatedAt: new Date().toISOString(),
          node: process.version,
          platform: process.platform,
          lighthouse: installation.version,
          chromium: installation.browserVersion,
          samplesPerProfileAndRoute: 3,
          bundle,
          results,
          summaries: summarizeSamples(results),
        },
        null,
        2,
      ) + "\n";
  } catch (error) {
    failure = error;
  }
  failure = await drainServices(services, failure);
  if (failure) throw failure;
  signal?.throwIfAborted();
  await writeReport(output, "summary.json", summary);
  return { output, samples: results.length, advisory: true };
}

await runVerificationCli(import.meta.main, repository, async ({ signal }) => {
  const args = process.argv.slice(2);
  if (args[0] === "--sample") {
    if (args.length !== 3)
      throw new Error("Specify one declared Lighthouse worker sample.");
    const result = await runLighthouseSample(repository, args[1], args[2]);
    process.stdout.write(JSON.stringify(result));
    return;
  }
  const { values } = parseArgs({
    options: { "skip-build": { type: "boolean" } },
  });
  const result = await runWebsitePerformance(repository, {
    signal,
    skipBuild: values["skip-build"] ?? false,
  });
  console.info("Advisory Lighthouse samples saved in " + result.output);
});
