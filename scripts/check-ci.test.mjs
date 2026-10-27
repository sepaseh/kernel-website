import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse, stringify } from "yaml";

import {
  inspectCi,
  validateCiWorkflow,
  validateSonarFontWorkflow,
} from "./check-ci.mjs";

const manifest = {
  checks: [{ id: "example", kind: "required", ciJobs: ["check"] }],
};
const fixture = () => ({
  on: {
    pull_request: {
      types: ["opened", "synchronize", "reopened", "ready_for_review"],
    },
  },
  jobs: {
    check: {
      "runs-on": "ubuntu-latest",
      steps: [
        {
          name: "Size",
          if: "github.event_name == 'pull_request'",
          run: "node scripts/check-pr-size.mjs",
        },
        { run: "npm ci" },
        {
          uses: "actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0",
          with: { "python-version": "3.14.4" },
        },
        {
          run: "python -m pip install --requirement font-source/requirements.txt",
        },
        { run: "npm run validate -- full" },
        { if: "always()", uses: "actions/upload-artifact@synthetic" },
      ],
    },
  },
});

test("the actual published workflow runs the canonical full gate on every PR", async () => {
  await inspectCi();
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-ci.mjs", import.meta.url))],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /complete canonical gate/);
});

test("unfiltered draft-capable triggers accept all activity types or an empty mapping", () => {
  for (const event of [
    null,
    {},
    {
      types: [
        "opened",
        "synchronize",
        "reopened",
        "ready_for_review",
        "edited",
      ],
    },
  ]) {
    const workflow = fixture();
    workflow.on.pull_request = event;
    assert.doesNotThrow(() =>
      validateCiWorkflow(stringify(workflow), manifest),
    );
  }
});

test("path, branch and narrowed activity filters cannot omit PR validation", () => {
  const invalidEvents = [
    { paths: ["src/**"] },
    { "paths-ignore": ["docs/**"] },
    { branches: ["main"] },
    { "branches-ignore": ["release/**"] },
    { types: ["opened", "synchronize"] },
    { types: "opened" },
    "unsupported",
  ];
  for (const event of invalidEvents) {
    const workflow = fixture();
    workflow.on.pull_request = event;
    assert.throws(() => validateCiWorkflow(stringify(workflow), manifest));
  }
  for (const trigger of [{ push: {} }, ["push"], null]) {
    const workflow = fixture();
    workflow.on = trigger;
    assert.throws(
      () => validateCiWorkflow(stringify(workflow), manifest),
      /pull_request/,
    );
  }
});

test("the mandatory check job cannot be absent, conditional, advisory or dependent", () => {
  for (const change of [
    (workflow) => {
      delete workflow.jobs.check;
    },
    (workflow) => {
      workflow.jobs.check = null;
    },
    (workflow) => {
      delete workflow.jobs.check.steps;
    },
    (workflow) => {
      workflow.jobs.check.if = "!github.event.pull_request.draft";
    },
    (workflow) => {
      workflow.jobs.check["continue-on-error"] = true;
    },
    (workflow) => {
      workflow.jobs.check["continue-on-error"] = "${{ inputs.allow_failure }}";
    },
    (workflow) => {
      workflow.jobs.check.needs = ["other"];
    },
    (workflow) => {
      workflow.jobs.check.strategy = { matrix: { include: [] } };
    },
  ]) {
    const workflow = fixture();
    change(workflow);
    assert.throws(() => validateCiWorkflow(stringify(workflow), manifest));
  }
});

test("installation and the full command must each run once, in order and fail closed", () => {
  const changes = [
    (steps) => {
      steps.splice(1, 1);
    },
    (steps) => {
      steps.splice(4, 1);
    },
    (steps) => {
      steps.push({ run: "npm ci" });
    },
    (steps) => {
      steps.push({ run: "npm run validate -- full" });
    },
    (steps) => {
      [steps[1], steps[4]] = [steps[4], steps[1]];
    },
    (steps) => {
      steps[1].if = "always()";
    },
    (steps) => {
      steps[4].if = "!github.event.pull_request.draft";
    },
    (steps) => {
      steps[4]["continue-on-error"] = true;
    },
    (steps) => {
      steps[1]["continue-on-error"] = "${{ inputs.allow_failure }}";
    },
    (steps) => {
      steps[4].run = "npm run validate -- full || true";
    },
    (steps) => {
      steps[4].run = "npm run test:unit";
    },
  ];
  for (const change of changes) {
    const workflow = fixture();
    change(workflow.jobs.check.steps);
    assert.throws(() => validateCiWorkflow(stringify(workflow), manifest));
  }
});

test("global, job and command directories cannot redirect validation to another tree", () => {
  for (const change of [
    (workflow) => {
      workflow.defaults = { run: { "working-directory": "other" } };
    },
    (workflow) => {
      workflow.jobs.check.defaults = { run: { "working-directory": "other" } };
    },
    (workflow) => {
      workflow.jobs.check.steps[1]["working-directory"] = "other";
    },
    (workflow) => {
      workflow.jobs.check.steps[4]["working-directory"] = "other";
    },
  ]) {
    const workflow = fixture();
    change(workflow);
    assert.throws(
      () => validateCiWorkflow(stringify(workflow), manifest),
      /repository root/,
    );
  }
  const workflow = fixture();
  workflow.defaults = { run: { "working-directory": "." } };
  workflow.jobs.check["continue-on-error"] = false;
  workflow.jobs.check.steps[4]["continue-on-error"] = false;
  assert.doesNotThrow(() => validateCiWorkflow(stringify(workflow), manifest));
});

test("a future multi-job or Windows phase needs an explicit CI policy transition", () => {
  for (const ciJobs of [undefined, [], ["visual"], ["check", "visual"]]) {
    assert.throws(
      () =>
        validateCiWorkflow(stringify(fixture()), {
          checks: [{ kind: "required", ciJobs }],
        }),
      /multi-job phase/,
    );
  }
  for (const value of [undefined, {}, { checks: [] }])
    assert.throws(() => validateCiWorkflow(stringify(fixture()), value));
});

test("custom shell wrappers cannot turn a failed install or validation into success", () => {
  for (const change of [
    (workflow) => {
      workflow.defaults = { run: { shell: "bash {0}; true" } };
    },
    (workflow) => {
      workflow.jobs.check.defaults = { run: { shell: "bash {0}; true" } };
    },
    (workflow) => {
      workflow.jobs.check.steps[1].shell = "bash {0}; true";
    },
    (workflow) => {
      workflow.jobs.check.steps[4].shell = "bash {0}; true";
    },
  ]) {
    const workflow = fixture();
    change(workflow);
    assert.throws(
      () => validateCiWorkflow(stringify(workflow), manifest),
      /fail-closed shell/,
    );
  }
});

test("invalid or duplicate YAML cannot reinterpret the mandatory workflow", async () => {
  for (const content of [
    "not: [valid",
    "jobs: {}\njobs: {}",
    "- unsupported",
    "on: &event {}\nother: *event",
  ])
    assert.throws(() => validateCiWorkflow(content, manifest));
  const source = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotThrow(() => validateCiWorkflow(source, manifest));
});

test("pinned font tooling cannot be omitted, replaced, made conditional or installed after validation", () => {
  for (const change of [
    (steps) => {
      steps.splice(2, 1);
    },
    (steps) => {
      steps.splice(3, 1);
    },
    (steps) => {
      steps[2].uses = "actions/setup-python@main";
    },
    (steps) => {
      steps[2].with["python-version"] = "3.x";
    },
    (steps) => {
      steps[2].if = "always()";
    },
    (steps) => {
      steps[3]["continue-on-error"] = true;
    },
    (steps) => {
      steps[3].run += " || true";
    },
    (steps) => {
      [steps[3], steps[4]] = [steps[4], steps[3]];
    },
  ]) {
    const workflow = fixture();
    change(workflow.jobs.check.steps);
    assert.throws(() => validateCiWorkflow(stringify(workflow), manifest));
  }
});

test("Sonar must generate actual Python coverage before its scanner", async () => {
  const content = await readFile(
    new URL("../.github/workflows/sonar.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotThrow(() => validateSonarFontWorkflow(content));
  for (const change of [
    (workflow) => {
      delete workflow.jobs.analysis;
    },
    (workflow) => {
      workflow.jobs.analysis.steps = [];
    },
    (workflow) => {
      workflow.jobs.analysis.steps = workflow.jobs.analysis.steps.filter(
        (step) => step.run !== "npm run check:fonts",
      );
    },
    (workflow) => {
      workflow.jobs.analysis.steps.find(
        (step) => step.run === "npm run check:fonts",
      ).if = "false";
    },
    (workflow) => {
      workflow.jobs.analysis.steps.find(
        (step) => step.run === "npm run check:fonts",
      )["working-directory"] = "../other";
    },
    (workflow) => {
      workflow.jobs.analysis.steps = workflow.jobs.analysis.steps.filter(
        (step) => !step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
      );
    },
    (workflow) => {
      const steps = workflow.jobs.analysis.steps;
      steps.unshift(steps.pop());
    },
    (workflow) => {
      const scanner = workflow.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
      );
      scanner["continue-on-error"] = true;
    },
    (workflow) => {
      workflow.defaults = { run: { shell: "bash {0}; true" } };
    },
  ]) {
    const workflow = parse(content);
    change(workflow);
    assert.throws(() => validateSonarFontWorkflow(stringify(workflow)));
  }
  assert.throws(() => validateSonarFontWorkflow("jobs: ["));
});
