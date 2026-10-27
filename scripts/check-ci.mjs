import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const pythonAction =
  "actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0";

const assertPullRequestTrigger = (workflow) => {
  if (!isRecord(workflow.on) || !Object.hasOwn(workflow.on, "pull_request"))
    throw new Error("CI must run on pull_request events, including drafts.");
  const event = workflow.on.pull_request;
  if (event === null) return;
  if (!isRecord(event))
    throw new Error("The pull_request trigger must be an unfiltered mapping.");
  const filters = ["paths", "paths-ignore", "branches", "branches-ignore"];
  if (filters.some((key) => Object.hasOwn(event, key)))
    throw new Error("PR CI must not filter changed paths or target branches.");
  if (
    event.types !== undefined &&
    (!Array.isArray(event.types) ||
      ["opened", "synchronize", "reopened", "ready_for_review"].some(
        (type) => !event.types.includes(type),
      ))
  )
    throw new Error("PR CI must retain every required pull_request activity.");
};

const assertRootDirectory = (directory) => {
  if (directory !== undefined && directory !== ".")
    throw new Error("Canonical validation must run in the repository root.");
};

const assertRunSettings = (settings) => {
  assertRootDirectory(settings?.["working-directory"]);
  if (settings?.shell !== undefined)
    throw new Error(
      "Canonical validation must use GitHub's default fail-closed shell.",
    );
};

const assertUnconditional = (entry) => {
  if (
    Object.hasOwn(entry, "if") ||
    (entry["continue-on-error"] !== undefined &&
      entry["continue-on-error"] !== false)
  )
    throw new Error(
      "Required CI execution must be unconditional and fail closed.",
    );
};

const assertCheckJob = (workflow) => {
  const job = workflow.jobs?.check;
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("CI needs the check job and its validation steps.");
  assertUnconditional(job);
  if (Object.hasOwn(job, "needs") || Object.hasOwn(job, "strategy"))
    throw new Error(
      "The complete check job must not depend on another job or use a matrix.",
    );
  assertRunSettings(workflow.defaults?.run);
  assertRunSettings(job.defaults?.run);
  return job;
};

const assertCanonicalSteps = (job) => {
  const commandSteps = (command) =>
    job.steps.flatMap((step, index) =>
      isRecord(step) &&
      typeof step.run === "string" &&
      step.run.trim() === command
        ? [{ step, index }]
        : [],
    );
  const installs = commandSteps("npm ci");
  const fullRuns = commandSteps("npm run validate -- full");
  if (installs.length !== 1 || fullRuns.length !== 1)
    throw new Error(
      "CI must install once and invoke the canonical full gate once.",
    );
  if (installs[0].index >= fullRuns[0].index)
    throw new Error("npm ci must precede complete canonical validation.");
  for (const { step } of [...installs, ...fullRuns]) {
    assertUnconditional(step);
    assertRunSettings(step);
  }
};

const assertFontTooling = (job, command) => {
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("Font verification requires an explicit job and steps.");
  const entries = job.steps.map((step, index) => ({ step, index }));
  const setups = entries.filter(({ step }) => step.uses === pythonAction);
  const installs = entries.filter(
    ({ step }) =>
      step.run?.trim() ===
      "python -m pip install --requirement font-source/requirements.txt",
  );
  const checks = entries.filter(({ step }) => step.run?.trim() === command);
  if (
    setups.length !== 1 ||
    installs.length !== 1 ||
    checks.length !== 1 ||
    setups[0].step.with?.["python-version"] !== "3.14.4" ||
    setups[0].index >= installs[0].index ||
    installs[0].index >= checks[0].index
  )
    throw new Error(
      "Pinned Python setup and font dependencies must precede required font verification.",
    );
  for (const { step } of [...setups, ...installs, ...checks]) {
    assertUnconditional(step);
    assertRunSettings(step);
  }
};

export const validateSonarFontWorkflow = (content) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error("Sonar workflow must be valid YAML.");
  const workflow = document.toJS({ maxAliasCount: 0 });
  const job = workflow?.jobs?.analysis;
  assertRunSettings(workflow?.defaults?.run);
  assertRunSettings(job?.defaults?.run);
  assertFontTooling(job, "npm run check:fonts");
  const font = job.steps.findIndex(
    (step) => step.run?.trim() === "npm run check:fonts",
  );
  const scanners = job.steps.flatMap((step, index) =>
    typeof step.uses === "string" &&
    step.uses.startsWith("SonarSource/sonarqube-scan-action@")
      ? [index]
      : [],
  );
  if (scanners.length !== 1 || scanners[0] <= font)
    throw new Error(
      "Real Python coverage must be generated before the Sonar scanner.",
    );
  assertUnconditional(job.steps[scanners[0]]);
};

const assertCheckOwnership = (manifest) => {
  if (!Array.isArray(manifest?.checks))
    throw new Error("CI needs the canonical required-check inventory.");
  const required = manifest.checks.filter((check) => check.kind === "required");
  if (
    !required.length ||
    required.some(
      (check) =>
        !Array.isArray(check.ciJobs) ||
        check.ciJobs.length !== 1 ||
        check.ciJobs[0] !== "check",
    )
  )
    throw new Error(
      "Every current required check must belong to check; a multi-job phase needs an explicit CI policy transition.",
    );
};

export const validateCiWorkflow = (content, manifest) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error("CI must be valid YAML without duplicate mapping keys.");
  const workflow = document.toJS({ maxAliasCount: 0 });
  if (!isRecord(workflow)) throw new Error("CI must be a workflow mapping.");
  assertPullRequestTrigger(workflow);
  assertCanonicalSteps(assertCheckJob(workflow));
  assertFontTooling(workflow.jobs.check, "npm run validate -- full");
  assertCheckOwnership(manifest);
};

export const inspectCi = async (root = repository) => {
  const [workflow, manifest, sonar] = await Promise.all([
    readFile(path.join(root, ".github/workflows/ci.yml"), "utf8"),
    readFile(path.join(root, ".agents/validation.json"), "utf8"),
    readFile(path.join(root, ".github/workflows/sonar.yml"), "utf8"),
  ]);
  validateCiWorkflow(workflow, JSON.parse(manifest));
  validateSonarFontWorkflow(sonar);
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await inspectCi();
    console.log("CI policy passed: every PR runs the complete canonical gate.");
  } catch (error) {
    console.error(
      JSON.stringify({
        message: error instanceof Error ? error.message : "CI policy failed.",
        status: "failed",
      }).replaceAll(/[\r\n\u2028\u2029]/g, " "),
    );
    process.exitCode = 1;
  }
}
