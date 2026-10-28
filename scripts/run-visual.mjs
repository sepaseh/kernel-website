import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { release } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  resolvePlaywrightInstallation,
  syntheticBrowserInputs,
} from "./browser-inputs.mjs";
import {
  artifactDirectory,
  artifactFile,
  completeArtifactWork,
  readArtifactFile,
} from "./release-files.mjs";
import { readyRunnerRoot } from "./runner-inputs.mjs";
import {
  runOwnedProcess,
  runVerificationCli,
  startOwnedProcess,
} from "./runner-process.mjs";
import {
  acquireVisualLock,
  assertReviewedVisualBaseline,
  assertVisualMode,
  assertVisualPortsAvailable,
  markVisualBaselinePending,
} from "./visual-environment.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const sourceInputs = [
  "package-lock.json",
  "playwright.visual.config.ts",
  "e2e/visual/website.spec.ts",
  "e2e/visual/readiness.ts",
  "src/app/globals.css",
  "src/website/home/Home.tsx",
  "src/website/layouts/Header.tsx",
  "src/features/login/Login.tsx",
  "src/features/register/Register.tsx",
  "src/shared/fonts/manifest.json",
  "src/shared/fonts/vazirmatn.css",
];
const browserProbeSource = `
const {chromium} = await import(process.argv[1]);
const browser = await chromium.launch({channel:'chromium',headless:true,env:process.env});
try { process.stdout.write(JSON.stringify({browserVersion:browser.version()})); }
finally { await browser.close(); }
`;

async function collectProbe(owned) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of owned.child.stdout) {
      bytes += chunk.length;
      if (bytes > 4096)
        throw new Error("Visual browser probe exceeded its bounded output.");
      chunks.push(chunk);
    }
  } catch (error) {
    try {
      await owned.stop();
    } catch (stopError) {
      throw new AggregateError(
        [error, stopError],
        "Visual browser output and owned process cleanup failed.",
        { cause: stopError },
      );
    }
    throw error;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function probeBrowser(root, installation, environment, signal) {
  const owned = startOwnedProcess({
    args: [
      "--input-type=module",
      "-e",
      browserProbeSource,
      pathToFileURL(installation.module).href,
    ],
    cwd: root,
    env: environment,
    signal,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const results = await completeArtifactWork([
    owned.completion,
    collectProbe(owned),
  ]);
  const browserVersion = results[1]?.browserVersion;
  if (
    typeof browserVersion !== "string" ||
    !browserVersion.trim() ||
    browserVersion.length > 128
  )
    throw new Error(
      "Visual browser probe must return an explicit browser version.",
    );
  return browserVersion;
}

async function requireNoNextLock(root) {
  try {
    await artifactDirectory(path.join(root, ".next"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  try {
    await lstat(path.join(root, ".next/lock"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("Another Next process owns .next/lock; no lock was removed.");
}

async function fingerprintSources(root) {
  const contents = await completeArtifactWork(
    sourceInputs.map((relative) => readArtifactFile(path.join(root, relative))),
  );
  const fingerprint = createHash("sha256");
  for (const [index, relative] of sourceInputs.entries()) {
    fingerprint.update(relative);
    fingerprint.update(contents[index]);
  }
  return fingerprint.digest("hex");
}

async function runCapture(
  root,
  installation,
  environment,
  signal,
  update,
  metadata,
  reportPath,
) {
  let failure;
  try {
    await runOwnedProcess({
      args: [
        installation.cli,
        "test",
        `--config=${path.join(root, "playwright.visual.config.ts")}`,
        ...(update ? ["--update-snapshots"] : []),
      ],
      cwd: root,
      env: environment,
      signal,
      stdio: "inherit",
    });
  } catch (error) {
    failure = error;
  }
  try {
    await markVisualBaselinePending(reportPath, {
      ...metadata,
      mode: update ? "update" : "compare",
      outcome: failure ? "failed" : "passed",
      exitCode: failure ? 1 : 0,
    });
  } catch (error) {
    failure = failure
      ? new AggregateError(
          [failure, error],
          "Visual capture and environment report failed.",
        )
      : error;
  }
  if (failure) throw failure;
}

async function withVisualLock(root, action) {
  const releaseLock = await acquireVisualLock(path.join(root, "test-results"));
  let result;
  let failure;
  try {
    result = await action();
  } catch (error) {
    failure = error;
  }
  try {
    await releaseLock();
  } catch (error) {
    failure = failure
      ? new AggregateError(
          [failure, error],
          "Visual operation and lock cleanup failed.",
        )
      : error;
  }
  if (failure) throw failure;
  return result;
}

export async function runVisual(root = repository, options = {}) {
  const directory = await readyRunnerRoot(root);
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError("Visual cancellation requires an AbortSignal.");
  signal?.throwIfAborted();
  const argv = options.argv ?? [];
  if (
    !Array.isArray(argv) ||
    argv.length > 1 ||
    argv.some((arg) => arg !== "--update")
  )
    throw new Error("Visual runs accept only one optional --update argument.");
  const update = argv.length === 1;
  const inputs = await syntheticBrowserInputs(
    directory,
    options.environment ?? process.env,
  );
  const platform = process.platform;
  assertVisualMode({
    update,
    ci: Boolean(inputs.websiteEnvironment.CI),
    platform,
  });
  const installation = await resolvePlaywrightInstallation(directory);
  await artifactFile(path.join(directory, "playwright.visual.config.ts"));
  const metadataPath = path.join(
    directory,
    "e2e/visual/baselines",
    platform,
    "metadata.json",
  );
  let baseline;
  if (!update) {
    baseline = JSON.parse(
      (await readArtifactFile(metadataPath)).toString("utf8"),
    );
    assertReviewedVisualBaseline(baseline, {
      platform,
      playwright: installation.version,
    });
  }
  return withVisualLock(directory, async () => {
    await requireNoNextLock(directory);
    await assertVisualPortsAvailable([
      Number(new URL(inputs.websiteOrigin).port),
      Number(new URL(inputs.apiOrigin).port),
    ]);
    signal?.throwIfAborted();
    const environment = {
      ...inputs.websiteEnvironment,
      KERNEL_VISUAL_RUNNER: "1",
      WEBSITE_SKIP_BUILD: "0",
      PLAYWRIGHT_BROWSERS_PATH: "0",
    };
    const browserVersion = await probeBrowser(
      directory,
      installation,
      environment,
      signal,
    );
    if (baseline)
      assertReviewedVisualBaseline(baseline, {
        platform,
        playwright: installation.version,
        browserVersion,
      });
    const metadata = {
      platform,
      arch: process.arch,
      osRelease: release(),
      node: process.version,
      playwright: installation.version,
      browser: "bundled-chromium",
      browserVersion,
      sourceFingerprint: await fingerprintSources(directory),
      sourceInputs,
      generatedAt: new Date().toISOString(),
      review: { status: "pending", reviewer: null, reviewedAt: null },
    };
    signal?.throwIfAborted();
    if (update) await markVisualBaselinePending(metadataPath, metadata);
    const reportPath = path.join(
      directory,
      "test-results/visual/environment.json",
    );
    await runCapture(
      directory,
      installation,
      environment,
      signal,
      update,
      metadata,
      reportPath,
    );
    return { mode: update ? "update" : "compare", metadataPath, reportPath };
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runVisual(repository, { signal, argv: process.argv.slice(2) }),
);
