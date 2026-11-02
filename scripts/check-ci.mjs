import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

import { readPublishedFile } from "./validate-bootstrap.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const ciProfiles = Object.freeze({
  quality: [
    "snapshot",
    "ci-policy",
    "actions-lint",
    "guidance",
    "boundaries",
    "lint",
    "format",
  ],
  audit: ["audit"],
  unit: ["unit-coverage"],
  governance: ["governance-coverage"],
});
export const aggregateCommand = `node -e "const needs = JSON.parse(process.env.CI_NEEDS); const required = ['quality', 'audit', 'unit', 'governance']; if (required.some(id => needs[id]?.result !== 'success')) process.exit(1);"`;
export const requiredChecks = Object.freeze([
  "snapshot",
  "ci-policy",
  "actions-lint",
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
  "check:actions",
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
export const installCommand =
  "npm ci --strict-peer-deps --ignore-scripts --no-audit --no-fund";
export const uploadAction =
  "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9";
export const downloadAction =
  "actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333";
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
    "All ten real checks run once.",
  );
  assert.deepEqual(
    manifest.checks.map((check) => check.id),
    requiredChecks,
  );
  for (const [index, check] of manifest.checks.entries()) {
    assert.equal(check.kind, "required");
    assert.equal(check.command, `npm run ${commands[index]}`);
    assert.deepEqual(check.ciJobs, [
      Object.keys(ciProfiles).find((job) => ciProfiles[job].includes(check.id)),
    ]);
  }
  for (const [job, ids] of Object.entries(ciProfiles))
    assert.deepEqual(manifest.profiles[`ci-${job}`], ids);

  const partition = Object.values(ciProfiles).flat();
  assert.equal(
    partition.length,
    manifest.profiles.full.length,
    "CI runs the same number of checks as the canonical full gate.",
  );
  assert.deepEqual(
    new Set(partition),
    new Set(manifest.profiles.full),
    "CI partitions the canonical full gate without omissions or duplicates.",
  );
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
    assert.notEqual(
      Boolean(step.uses),
      Boolean(step.run),
      "Steps execute one action or command.",
    );
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
      assert.equal(step.with?.cache, "npm");
    }
  }
};

export function validateCiWorkflow(content, manifest) {
  validateCheckManifest(manifest);
  const workflow = workflowDocument(content);
  assert.deepEqual(workflow.permissions, {
    contents: "read",
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
  assert.deepEqual(Object.keys(workflow.jobs), [
    "quality",
    "audit",
    "unit",
    "governance",
    "check",
    "analysis",
  ]);
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
  assert.deepEqual(workflow.concurrency, {
    group: "ci-${{ github.event_name }}-${{ github.ref }}",
    "cancel-in-progress": false,
  });
  assert.equal(workflow.defaults?.run?.["working-directory"], undefined);
  const labels = {
    quality: "Static checks",
    audit: "Dependency audit",
    unit: "Unit tests",
    governance: "Governance tests",
  };
  for (const [name, label] of Object.entries(labels)) {
    const job = workflow.jobs[name];
    unconditional(job);
    assert.equal(job.name, label);
    assert.equal(job.needs, undefined);
    assert.equal(job.strategy, undefined);
    assert.equal(job["timeout-minutes"], name === "audit" ? 5 : 20);
    assert.equal(job["runs-on"], "ubuntu-latest");
    pinnedActions(job);
    assert.equal(job.steps[0].with.ref, "${{ github.sha }}");
    const suite = name === "unit" || name === "governance";
    const expected = [checkoutAction, nodeAction];
    if (name !== "audit") expected.push(installCommand);
    expected.push(`npm run validate -- ci-${name}`);
    if (suite)
      expected.push("node scripts/ci-evidence.mjs --record", uploadAction);
    assert.deepEqual(
      job.steps.map((step) => step.uses ?? step.run),
      expected,
    );
    if (suite) {
      assert.deepEqual(job.outputs, {
        artifact: "${{ steps.evidence.outputs.artifact }}",
        attempt: "${{ steps.evidence.outputs.attempt }}",
      });
      assert.equal(job.steps[4].id, "evidence");
      assert.deepEqual(job.steps[4].env, { CI_EVIDENCE_SUITE: name });
      assert.deepEqual(job.steps[5].with, {
        name: "${{ steps.evidence.outputs.artifact }}",
        path: `coverage/${name}/lcov.info\ncoverage/${name}/ci-evidence.json\n`,
        "if-no-files-found": "error",
        "retention-days": 3,
        overwrite: false,
        "include-hidden-files": false,
      });
    } else assert.equal(job.outputs, undefined);
    job.steps.forEach(unconditional);
  }
  const check = workflow.jobs.check;
  assert.deepEqual(check.needs, Object.keys(ciProfiles));
  assert.equal(check.if, "always()");
  assert.equal(check["continue-on-error"], undefined);
  assert.equal(check["runs-on"], "ubuntu-latest");
  assert.equal(check["timeout-minutes"], 5);
  assert.deepEqual(check.permissions, {});
  assert.equal(check.outputs, undefined);
  assert.equal(check.steps.length, 1);
  assert.deepEqual(check.steps[0].env, { CI_NEEDS: "${{ toJSON(needs) }}" });
  assert.equal(check.steps[0].run, aggregateCommand);
  unconditional(check.steps[0]);
  validateSonarWorkflow(content);
}

export function validateSonarWorkflow(content) {
  const workflow = workflowDocument(content);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs?.analysis;
  assert.equal(job?.name, "SonarQube Cloud analysis");
  assert.deepEqual(job.needs, ["check", "unit", "governance"]);
  assert.equal(job["runs-on"], "ubuntu-latest");
  assert.equal(job["timeout-minutes"], 15);
  assert.equal(job["continue-on-error"], undefined);
  assert.equal(
    job.if,
    "needs.check.result == 'success' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)",
  );
  assert.ok(Array.isArray(job.steps));
  pinnedActions(job);
  const [checkout, , configured] = job.steps;
  assert.equal(job.steps.length, 9);
  assert.equal(checkout.with.ref, "${{ github.sha }}");
  assert.equal(checkout.with["fetch-depth"], 0);
  assert.deepEqual(configured.env, {
    SONAR_TOKEN_CONFIGURED: "${{ secrets.SONAR_TOKEN != '' }}",
    SONAR_PROJECT_KEY: "${{ vars.SONAR_PROJECT_KEY }}",
  });
  assert.match(configured.run, /exit 1/);
  for (const [index, suite] of ["unit", "governance"].entries()) {
    const download = job.steps[3 + index * 2];
    const verify = job.steps[4 + index * 2];
    assert.equal(download.uses, downloadAction);
    assert.deepEqual(download.with, {
      name: "${{ needs." + suite + ".outputs.artifact }}",
      path: `coverage/${suite}`,
      "digest-mismatch": "error",
    });
    assert.equal(verify.run, "node scripts/ci-evidence.mjs --verify-coverage");
    assert.deepEqual(verify.env, {
      CI_EVIDENCE_SUITE: suite,
      CI_EVIDENCE_PRODUCER_ATTEMPT:
        "${{ needs." + suite + ".outputs.attempt }}",
    });
  }
  assert.equal(job.steps[7].run, installCommand);
  const scanner = job.steps[8];
  assert.equal(scanner.uses, scannerAction);
  assert.deepEqual(scanner.env, {
    SONAR_HOST_URL: "${{ vars.SONAR_HOST_URL || 'https://sonarcloud.io' }}",
    SONAR_TOKEN: "${{ secrets.SONAR_TOKEN }}",
  });
  assert.equal(
    scanner.with?.args,
    "-Dsonar.projectKey=${{ vars.SONAR_PROJECT_KEY }} -Dsonar.scm.revision=${{ github.event.pull_request.head.sha || github.sha }}",
  );
  job.steps.forEach(unconditional);
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
    assert.equal(
      workflow.jobs.analyze.name,
      "Analyze JavaScript, TypeScript and GitHub Actions",
    );
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
      languages: "javascript-typescript,actions",
      queries: "security-extended",
    });
  } else {
    assert.fail("Only the real CodeQL security workflow is additional policy.");
  }
}

export function validateDependabot(content) {
  const configuration = workflowDocument(content);
  assert.equal(configuration.version, 2);
  assert.deepEqual(
    configuration.updates.map((update) => update["package-ecosystem"]),
    ["npm", "github-actions"],
  );
  for (const update of configuration.updates) {
    assert.equal(update.directory, "/");
    assert.deepEqual(update.schedule, {
      interval: "weekly",
      day: "monday",
      time: "09:00",
      timezone: "Asia/Tehran",
    });
    const npm = update["package-ecosystem"] === "npm";
    assert.equal(update["open-pull-requests-limit"], npm ? 10 : 5);
    assert.deepEqual(update.reviewers, ["sepaseh"]);
    assert.deepEqual(update["commit-message"], {
      prefix: "chore",
      include: "scope",
    });
    assert.deepEqual(
      update.groups,
      npm
        ? {
            "production-minor-and-patch": {
              "dependency-type": "production",
              "update-types": ["minor", "patch"],
            },
            "development-minor-and-patch": {
              "dependency-type": "development",
              "update-types": ["minor", "patch"],
            },
          }
        : {
            "actions-minor-and-patch": {
              patterns: ["*"],
              "update-types": ["minor", "patch"],
            },
          },
    );
  }
}

export async function inspectCi(root = repository) {
  const manifest = JSON.parse(
    await readPublishedFile(root, ".agents/validation.json"),
  );
  validateDependabot(await readPublishedFile(root, ".github/dependabot.yml"));
  validateCiWorkflow(
    await readPublishedFile(root, ".github/workflows/ci.yml"),
    manifest,
  );
  validateSonarWorkflow(
    await readPublishedFile(root, ".github/workflows/ci.yml"),
  );
  validateAdditionalWorkflow(
    "codeql",
    await readPublishedFile(root, ".github/workflows/codeql.yml"),
  );
}

if (import.meta.main) {
  await inspectCi();
  console.log(
    "Governance CI, native security and real Sonar coverage order passed.",
  );
}
