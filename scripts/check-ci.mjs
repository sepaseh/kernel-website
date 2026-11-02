import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

import { maximumChangedFiles } from "./check-pr-size.mjs";
import {
  completePublicationWork,
  readPublishedFile,
} from "./validate-bootstrap.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const requiredChecks = Object.freeze([
  "snapshot",
  "ci-policy",
  "guidance",
  "audit",
  "boundaries",
  "lint",
  "format",
  "unit-coverage",
  "governance-coverage",
]);
const commands = [
  "check:snapshot",
  "check:ci",
  "check:guidance",
  "audit",
  "check:boundaries",
  "lint",
  "format:check",
  "test:unit",
  "test:governance",
];
export const checkoutAction =
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
export const nodeAction =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
export const scannerAction =
  "SonarSource/sonarqube-scan-action@d209202bc7d53ff1cc128f7f907dac145c9d6ae9";

export function workflowDocument(content) {
  const parsed = parseDocument(content, { uniqueKeys: true });
  assert.equal(
    parsed.errors.length,
    0,
    "Workflow must be valid YAML without duplicate keys.",
  );
  const workflow = parsed.toJS({ maxAliasCount: 0 });
  assert.ok(
    workflow && typeof workflow === "object" && !Array.isArray(workflow),
    "Expected a workflow mapping.",
  );
  return workflow;
}

export function validateCheckManifest(manifest) {
  assert.equal(manifest.phase, "governance");
  assert.equal(manifest.applicationReady, false);
  assert.deepEqual(
    manifest.profiles?.full,
    requiredChecks,
    "All nine real checks run once.",
  );
  assert.deepEqual(
    manifest.checks.map((check) => check.id),
    requiredChecks,
  );
  for (const [index, check] of manifest.checks.entries()) {
    assert.equal(check.kind, "required");
    assert.equal(check.command, `npm run ${commands[index]}`);
    assert.deepEqual(check.ciJobs, ["check"]);
  }
}

const unconditional = (entry) => {
  assert.equal(
    Object.hasOwn(entry, "if"),
    false,
    "Required checks cannot be skipped.",
  );
  assert.ok(
    entry["continue-on-error"] === undefined ||
      entry["continue-on-error"] === false,
    "Checks must fail closed.",
  );
  assert.equal(
    entry["working-directory"],
    undefined,
    "Checks run in the package root.",
  );
};
const pinnedActions = (job) => {
  for (const step of job.steps) {
    if (step.uses)
      assert.match(
        step.uses,
        /^[\w.-]+\/[\w./-]+@[a-f\d]{40}$/,
        "Actions must use immutable SHA pins.",
      );
    if (step.uses?.startsWith("actions/checkout@")) {
      assert.equal(step.uses, checkoutAction);
      assert.equal(step.with?.["persist-credentials"], false);
    }
    if (step.uses?.startsWith("actions/setup-node@")) {
      assert.equal(step.uses, nodeAction);
      assert.equal(step.with?.["node-version-file"], ".nvmrc");
    }
  }
};

export function validateCiWorkflow(content, manifest) {
  validateCheckManifest(manifest);
  const workflow = workflowDocument(content);
  assert.deepEqual(workflow.permissions, {
    contents: "read",
    "pull-requests": "read",
  });
  assert.ok(
    Object.hasOwn(workflow.on, "pull_request"),
    "Every PR including drafts needs CI.",
  );
  const event = workflow.on.pull_request;
  if (event !== null) {
    assert.ok(event && typeof event === "object" && !Array.isArray(event));
    assert.equal(
      ["paths", "paths-ignore", "branches", "branches-ignore"].some((field) =>
        Object.hasOwn(event, field),
      ),
      false,
      "PR checks cannot filter paths or target branches.",
    );
    for (const activity of [
      "opened",
      "synchronize",
      "reopened",
      "ready_for_review",
    ])
      assert.ok(
        event.types?.includes(activity),
        "Required PR activity is missing.",
      );
  }
  assert.deepEqual(
    Object.keys(workflow.jobs),
    ["check"],
    "Only the genuine governance check job is published.",
  );
  const job = workflow.jobs.check;
  unconditional(job);
  assert.equal(job.needs, undefined);
  assert.equal(job.strategy, undefined);
  assert.equal(workflow.defaults?.run?.["working-directory"], undefined);
  pinnedActions(job);
  assert.deepEqual(
    job.steps.map((step) => step.uses ?? step.run),
    [
      checkoutAction,
      nodeAction,
      "node scripts/check-pr-size.mjs",
      "npm ci --ignore-scripts",
      "npm run validate -- full",
    ],
  );
  const size = job.steps[2];
  assert.equal(size.if, "github.event_name == 'pull_request'");
  assert.deepEqual(size.env, { GITHUB_TOKEN: "${{ github.token }}" });
  assert.equal(size["continue-on-error"], undefined);
  assert.equal(size["working-directory"], undefined);
  job.steps.filter((_, index) => index !== 2).forEach(unconditional);
}

export function validateSonarWorkflow(content) {
  const workflow = workflowDocument(content);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs?.analysis;
  assert.equal(job?.name, "SonarQube Cloud analysis");
  assert.equal(
    job.if,
    "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository",
    "Sonar runs for every trusted PR head and skips untrusted forks.",
  );
  assert.ok(Array.isArray(job.steps));
  pinnedActions(job);
  const position = (run) =>
    job.steps.findIndex((step) => step.run?.trim() === run);
  const install = position("npm ci --ignore-scripts");
  const snapshot = position("node scripts/validate-bootstrap.mjs");
  const unit = position("npm run test:unit");
  const governance = position("npm run test:governance");
  const scans = job.steps.flatMap((step, index) =>
    step.uses?.startsWith("SonarSource/") ? [index] : [],
  );
  assert.equal(scans.length, 1, "One genuine scanner is required.");
  assert.ok(
    snapshot >= 0 &&
      snapshot < install &&
      install < unit &&
      install < governance &&
      unit < scans[0] &&
      governance < scans[0],
    "Measure published coverage before scanning.",
  );
  for (const index of [snapshot, install, unit, governance, scans[0]])
    unconditional(job.steps[index]);
  const scanner = job.steps[scans[0]];
  assert.equal(scanner.uses, scannerAction);
  assert.equal(scanner.env?.SONAR_TOKEN, "${{ secrets.SONAR_TOKEN }}");
  assert.match(
    scanner.with?.args ?? "",
    /sonar\.projectKey=\$\{\{ vars\.SONAR_PROJECT_KEY \}\}/,
  );
  assert.equal(
    job.steps.some((step) =>
      /fonts|python|playwright|npm run build/.test(step.run ?? ""),
    ),
    false,
    "Unpublished runtime checks cannot be claimed.",
  );
}

export function validatePrWorkflow(content) {
  const workflow = workflowDocument(content);
  assert.deepEqual(workflow.permissions, {
    contents: "read",
    "pull-requests": "read",
  });
  assert.ok(Object.hasOwn(workflow.on, "pull_request_target"));
  assert.deepEqual(workflow.concurrency, {
    "cancel-in-progress": true,
    group:
      "pr-policy-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}",
  });
  const job = workflow.jobs?.["file-limit"];
  assert.equal(job?.name, "PR file limit");
  unconditional(job);
  pinnedActions(job);
  const checkout = job.steps.find((step) => step.uses === checkoutAction);
  assert.equal(
    checkout?.with?.ref,
    "${{ github.workflow_sha }}",
    "Privileged policy uses immutable default-branch source.",
  );
  assert.deepEqual(
    job.steps.filter((step) => step.run).map((step) => step.run),
    ["node scripts/check-pr-size.mjs"],
  );
  job.steps.forEach(unconditional);
  assert.equal(maximumChangedFiles, 100);
}

export function validateAdditionalWorkflow(filename, content) {
  const workflow = workflowDocument(content);
  assert.ok(
    Object.keys(workflow.jobs ?? {}).length,
    "Every published workflow must contain real jobs.",
  );
  for (const job of Object.values(workflow.jobs)) pinnedActions(job);
  if (filename === "codeql") {
    unconditional(workflow.jobs.analyze);
    assert.ok(
      Object.hasOwn(workflow.on, "pull_request"),
      "CodeQL must inspect every PR base.",
    );
    const event = workflow.on.pull_request;
    assert.ok(
      event === null ||
        (typeof event === "object" &&
          !Array.isArray(event) &&
          Object.keys(event).length === 0),
      "CodeQL PR checks cannot filter branches, paths or activities.",
    );
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.deepEqual(workflow.jobs.analyze.permissions, {
      contents: "read",
      "security-events": "write",
    });
    const steps = workflow.jobs.analyze.steps;
    assert.deepEqual(
      steps.map((step) => step.uses),
      [
        checkoutAction,
        "github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938",
        "github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938",
      ],
    );
    assert.deepEqual(steps[1].with, {
      languages: "javascript-typescript",
      "build-mode": "none",
      queries: "security-extended",
    });
  } else {
    assert.deepEqual(workflow.permissions, {});
    if (filename === "review-signal") {
      assert.equal(workflow.name, "CodeRabbit review signal");
      assert.deepEqual(workflow.on.pull_request_review.types, [
        "submitted",
        "edited",
        "dismissed",
      ]);
      assert.equal(workflow.jobs.signal.permissions, undefined);
      assert.equal(workflow.jobs.signal.steps.length, 1);
      assert.equal(workflow.jobs.signal.steps[0].env, undefined);
      assert.equal(workflow.jobs.signal.steps[0].uses, undefined);
    } else {
      assert.equal(filename, "review-policy");
      const job = workflow.jobs.verify;
      assert.deepEqual(job.permissions, {
        actions: "read",
        checks: "read",
        contents: "read",
        "pull-requests": "read",
        statuses: "write",
      });
      assert.equal(
        job.if,
        "github.workflow_ref == format('{0}/.github/workflows/review-policy.yml@refs/heads/{1}', github.repository, github.event.repository.default_branch) && (github.event_name != 'check_run' || (github.event.check_run.app.id == 347564 && github.event.check_run.name == 'CodeRabbit'))",
      );
      assert.equal(job.steps[0].with.ref, "${{ github.workflow_sha }}");
      assert.deepEqual(
        job.steps.map((step) => step.uses ?? step.run),
        [checkoutAction, nodeAction, "node scripts/review-policy.mjs"],
      );
    }
  }
}

export async function inspectCi(root = repository) {
  const manifest = JSON.parse(
    await readPublishedFile(root, ".agents/validation.json"),
  );
  validateCiWorkflow(
    await readPublishedFile(root, ".github/workflows/ci.yml"),
    manifest,
  );
  validateSonarWorkflow(
    await readPublishedFile(root, ".github/workflows/sonar.yml"),
  );
  validatePrWorkflow(
    await readPublishedFile(root, ".github/workflows/pr-policy.yml"),
  );
  await completePublicationWork(
    ["codeql", "review-policy", "review-signal"].map(async (filename) => {
      validateAdditionalWorkflow(
        filename,
        await readPublishedFile(root, `.github/workflows/${filename}.yml`),
      );
    }),
  );
}

if (import.meta.main) {
  await inspectCi();
  console.log(
    "Governance CI, trusted PR policy and real Sonar coverage order passed.",
  );
}
