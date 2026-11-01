import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  inspectCi,
  validateAdditionalWorkflow,
  validateCheckManifest,
  validateCiWorkflow,
  validatePrWorkflow,
  validateSonarWorkflow,
  workflowDocument,
} from "./check-ci.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read(".agents/validation.json"));
const ci = workflowDocument(await read(".github/workflows/ci.yml"));
const sonar = workflowDocument(await read(".github/workflows/sonar.yml"));
const pr = workflowDocument(await read(".github/workflows/pr-policy.yml"));

test("actual workflows execute the nine declared governance checks and real measured Sonar submission", async () => {
  await inspectCi();
  validateCheckManifest(manifest);
});

test("manifest cannot drop, repeat, replace or soften a required check", () => {
  for (const change of [
    (value) => {
      value.phase = "operations";
    },
    (value) => {
      value.applicationReady = true;
    },
    (value) => value.profiles.full.pop(),
    (value) => value.profiles.full.push(value.profiles.full[0]),
    (value) => {
      value.checks[0].kind = "advisory";
    },
    (value) => {
      value.checks[0].command = "npm run false-green";
    },
    (value) => {
      value.checks[0].ciJobs = ["fake"];
    },
  ]) {
    const value = structuredClone(manifest);
    change(value);
    assert.throws(() => validateCheckManifest(value));
  }
});

test("CI rejects filtering, draft skips, conditional checks, action drift and shell bypasses", () => {
  for (const change of [
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      delete value.on.pull_request;
    },
    (value) => {
      value.on.pull_request = { paths: ["src/**"] };
    },
    (value) => {
      value.on.pull_request = [];
    },
    (value) => {
      value.on.pull_request = { types: ["opened"] };
    },
    (value) => {
      value.jobs.check.if = "!github.event.pull_request.draft";
    },
    (value) => {
      value.jobs.check["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.check.needs = "ignored";
    },
    (value) => {
      value.jobs.check.strategy = {};
    },
    (value) => {
      value.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      value.jobs.check.steps[0].uses = "actions/checkout@main";
    },
    (value) => {
      value.jobs.check.steps[0].with["persist-credentials"] = true;
    },
    (value) => {
      value.jobs.check.steps[1].with["node-version-file"] = "other";
    },
    (value) => {
      value.jobs.check.steps.at(-1).run = "echo fake-green";
    },
    (value) => {
      value.jobs.check.steps.at(-1).if = "false";
    },
    (value) => {
      value.jobs.check.steps.at(-1)["working-directory"] = "other";
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
  const unfiltered = structuredClone(ci);
  unfiltered.on.pull_request = null;
  validateCiWorkflow(JSON.stringify(unfiltered), manifest);
  assert.throws(() => workflowDocument("jobs: ["));
  assert.throws(() => workflowDocument("jobs: {}\njobs: {}"));
  assert.throws(() => workflowDocument("[]"));
});

test("Sonar cannot scan without same-tree unit/governance coverage or import unpublished runtime checks", () => {
  for (const change of [
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      value.jobs.analysis.name = "fake";
    },
    (value) => {
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step.run !== "npm run test:unit",
      );
    },
    (value) => {
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step.run !== "npm run test:governance",
      );
    },
    (value) => value.jobs.analysis.steps.reverse(),
    (value) => {
      value.jobs.analysis.steps.at(-1).env.SONAR_TOKEN = "literal-token";
    },
    (value) => {
      value.jobs.analysis.steps.at(-1).with.args = "";
    },
    (value) => value.jobs.analysis.steps.push({ run: "npm run check:fonts" }),
  ]) {
    const value = structuredClone(sonar);
    change(value);
    assert.throws(() => validateSonarWorkflow(JSON.stringify(value)));
  }
});

test("privileged file-limit workflow cannot execute PR source or arbitrary commands", () => {
  for (const change of [
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      delete value.on.pull_request_target;
    },
    (value) => {
      value.jobs["file-limit"].steps[0].with.ref =
        "${{ github.event.pull_request.head.sha }}";
    },
    (value) => {
      value.jobs["file-limit"].steps.at(-1).run = "node unreviewed.mjs";
    },
    (value) => {
      value.jobs["file-limit"].if = "false";
    },
  ]) {
    const value = structuredClone(pr);
    change(value);
    assert.throws(() => validatePrWorkflow(JSON.stringify(value)));
  }
});

test("security and review workflows retain exact permissions, trusted source and independent signals", async () => {
  for (const [name, changes] of [
    [
      "codeql",
      [
        (value) => {
          value.permissions.contents = "write";
        },
        (value) => {
          value.jobs.analyze.permissions["security-events"] = "read";
        },
        (value) => {
          value.jobs.analyze.steps[1].with.queries = "default";
        },
      ],
    ],
    [
      "review-signal",
      [
        (value) => {
          value.permissions = { contents: "write" };
        },
        (value) => {
          value.jobs.signal.permissions = { statuses: "write" };
        },
        (value) => {
          value.jobs.signal.steps[0].env = { GITHUB_TOKEN: "untrusted" };
        },
      ],
    ],
    [
      "review-policy",
      [
        (value) => {
          value.jobs.verify.permissions.contents = "write";
        },
        (value) => {
          value.jobs.verify.if += " || true";
        },
        (value) => {
          value.jobs.verify.steps[0].with.ref =
            "${{ github.event.pull_request.head.sha }}";
        },
      ],
    ],
  ]) {
    const original = workflowDocument(
      await read(`.github/workflows/${name}.yml`),
    );
    for (const change of changes) {
      const value = structuredClone(original);
      change(value);
      assert.throws(() =>
        validateAdditionalWorkflow(name, JSON.stringify(value)),
      );
    }
  }
});
