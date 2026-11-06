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
import { runVerificationCli, startOwnedProcess } from "./runner-process.mjs";
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
  "src/features/home/Home.tsx",
  "src/app/_components/Header.tsx",
  "src/features/auth/login/Login.tsx",
  "src/features/auth/register/Register.tsx",
  "src/shared/fonts/manifest.json",
  "src/shared/fonts/vazirmatn.css",
];
const browserProbeSource = `
const {chromium} = await import(process.argv[1]);
const browser = await chromium.launch({channel:'chromium',headless:true,env:process.env});
try { process.stdout.write(JSON.stringify({browserVersion:browser.version()})); }
finally { await browser.close(); }
`;

/**
 * Drain bounded probe output and parse its JSON result. A read/size failure stops
 * the owned child and preserves both the output failure and any stop failure.
 */
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

/**
 * Launch the selected SDK in an owned filtered child, track its actual closure,
 * and return a bounded nonempty browser version after process and stream completion.
 */
async function probeBrowser(
  root,
  installation,
  environment,
  signal,
  trackChild,
) {
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
  trackChild(owned.child);
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

/** Refuse an existing Next build lock without removing another process's ownership. */
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

/**
 * Hash declared source paths and exact artifact bytes in a stable order. This
 * provenance digest describes those inputs, not a completed visual review.
 */
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

/**
 * Run the validated snapshot CLI with owned cancellation and record a pending
 * environment report for success or failure. Preserve capture and report errors
 * together; actual child closure determines whether the enclosing lock can clear.
 */
async function runCapture({
  root,
  installation,
  environment,
  signal,
  update,
  metadata,
  reportPath,
  trackChild,
}) {
  let failure;
  try {
    const owned = startOwnedProcess({
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
    trackChild(owned.child);
    await owned.completion;
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

/**
 * Execute one visual action under exclusive output ownership, preserving action
 * and release failures. An unclosed tracked child retains the lock file even
 * when its completion promise has already rejected at the stop deadline.
 */
async function withVisualLock(root, action) {
  const releaseLock = await acquireVisualLock(path.join(root, "test-results"));
  const activeChildren = new Set();
  /** Track real close events rather than assuming completion implies shutdown. */
  const trackChild = (child) => {
    activeChildren.add(child);
    child.once("close", () => activeChildren.delete(child));
  };
  let result;
  let failure;
  try {
    result = await action(trackChild);
  } catch (error) {
    failure = error;
  }
  try {
    // Completion can reject at the bounded stop deadline before actual close.
    // Keep exclusion in that case, including retries on different fixture ports.
    await releaseLock({ retain: activeChildren.size > 0 });
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

/**
 * Gate all visual work on application readiness and explicit inputs, then compare
 * reviewed baselines or mark an authorized update pending before capture. CI
 * updates are forbidden; this guarded operation does not authorize baseline changes.
 */
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
    (argv.length === 1 && argv[0] !== "--update")
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
  return withVisualLock(directory, async (trackChild) => {
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
      trackChild,
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
    await runCapture({
      root: directory,
      installation,
      environment,
      signal,
      update,
      metadata,
      reportPath,
      trackChild,
    });
    return { mode: update ? "update" : "compare", metadataPath, reportPath };
  });
}

await runVerificationCli(import.meta.main, repository, ({ signal }) =>
  runVisual(repository, { signal, argv: process.argv.slice(2) }),
);
