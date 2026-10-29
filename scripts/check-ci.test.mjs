import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse, stringify } from "yaml";

import {
  inspectCi,
  validateCiWorkflow,
  validateOperationalWorkflows,
  validateSonarFontWorkflow,
} from "./check-ci.mjs";

const operationalContents = async () =>
  Object.fromEntries(
    await Promise.all(
      [
        "codeql",
        "dast",
        "deployment-smoke",
        "package-release",
        "release",
        "staging",
      ].map(async (name) => [
        name,
        await readFile(
          new URL("../.github/workflows/" + name + ".yml", import.meta.url),
          "utf8",
        ),
      ]),
    ),
  );
const changeOperational = async (name, change) => {
  const contents = await operationalContents();
  const workflow = parse(contents[name]);
  change(workflow, Object.values(workflow.jobs)[0]);
  contents[name] = stringify(workflow);
  return contents;
};

test("operational publication retains the same mandatory application gate", async () => {
  const { workflow, applicationManifest } = await applicationFixture();
  applicationManifest.phase = "operations";
  assert.doesNotThrow(() =>
    validateCiWorkflow(stringify(workflow), applicationManifest),
  );
  assert.doesNotThrow(
    validateOperationalWorkflows.bind(null, await operationalContents()),
  );
});

test("all six operational sources are required and malformed YAML is rejected", async () => {
  for (const value of [undefined, [], {}, { unrelated: "" }])
    assert.throws(() => validateOperationalWorkflows(value));
  const original = await operationalContents();
  for (const name of Object.keys(original)) {
    const missing = { ...original };
    delete missing[name];
    assert.throws(() => validateOperationalWorkflows(missing));
    for (const invalid of [
      "jobs: [",
      "jobs: {}\njobs: {}",
      "- unrelated",
      "null",
      "jobs: &job {}\nother: *job",
    ])
      assert.throws(() =>
        validateOperationalWorkflows({ ...original, [name]: invalid }),
      );
  }
});

test("operational mappings are order independent while required input names remain exact", async () => {
  const sources = await operationalContents();
  const reordered = Object.fromEntries(
    Object.entries(sources)
      .reverse()
      .map(([name, source]) => {
        const workflow = parse(source);
        workflow.on = Object.fromEntries(Object.entries(workflow.on).reverse());
        if (workflow.on.workflow_dispatch?.inputs)
          workflow.on.workflow_dispatch.inputs = Object.fromEntries(
            Object.entries(workflow.on.workflow_dispatch.inputs).reverse(),
          );
        return [name, stringify(workflow)];
      }),
  );
  assert.doesNotThrow(() => validateOperationalWorkflows(reordered));
  const wrong = parse(reordered.dast);
  const inputs = wrong.on.workflow_dispatch.inputs;
  const [name] = Object.keys(inputs);
  inputs.foreign_input = inputs[name];
  delete inputs[name];
  assert.throws(() =>
    validateOperationalWorkflows({ ...reordered, dast: stringify(wrong) }),
  );
});

test("only CodeQL may run automatically and target operations stay on main", async () => {
  for (const name of [
    "dast",
    "deployment-smoke",
    "package-release",
    "release",
    "staging",
  ]) {
    for (const change of [
      (workflow) => {
        workflow.on.push = {};
      },
      (workflow) => {
        workflow.on.pull_request_target = {};
      },
      (_workflow, job) => {
        delete job.if;
      },
      (_workflow, job) => {
        job.if = "always()";
      },
    ])
      assert.throws(
        validateOperationalWorkflows.bind(
          null,
          await changeOperational(name, change),
        ),
      );
  }
});

test("manual inputs, source identity, permissions and execution cannot broaden", async () => {
  for (const name of [
    "dast",
    "deployment-smoke",
    "package-release",
    "release",
    "staging",
  ]) {
    const changes = [
      (workflow) => {
        workflow.permissions.contents = "write";
      },
      (workflow) => {
        workflow.env = { PRIVATE_TOKEN: "synthetic-value" };
      },
      (_workflow, job) => {
        job["continue-on-error"] = true;
      },
      (_workflow, job) => {
        job["timeout-minutes"] = 0;
      },
      (_workflow, job) => {
        job["timeout-minutes"] = 91;
      },
      (_workflow, job) => {
        job.strategy = { matrix: { runtime: ["untrusted"] } };
      },
      (_workflow, job) => {
        job.environment = "production";
      },
      (_workflow, job) => {
        job["runs-on"] = "self-hosted";
      },
      (_workflow, job) => {
        job.defaults = { run: { "working-directory": "../foreign" } };
      },
      (_workflow, job) => {
        job.steps.push({ run: "curl https://production.example.test" });
      },
      (_workflow, job) => {
        job.steps[0] = null;
      },
      (_workflow, job) => {
        job.steps[0].if = "false";
      },
      (_workflow, job) => {
        job.steps[0].uses = "untrusted/action@main";
      },
      (_workflow, job) => {
        job.steps[0].env = { SECRET: "synthetic" };
      },
      (workflow) => {
        workflow.defaults = { run: { shell: "bash {0}; true" } };
      },
    ];
    for (const change of changes)
      assert.throws(
        validateOperationalWorkflows.bind(
          null,
          await changeOperational(name, change),
        ),
      );
  }
  for (const name of [
    "dast",
    "deployment-smoke",
    "package-release",
    "staging",
  ]) {
    for (const change of [
      (workflow) => {
        Object.values(workflow.on.workflow_dispatch.inputs)[0].required = false;
      },
      (workflow) => {
        Object.values(workflow.on.workflow_dispatch.inputs)[0].type = "boolean";
      },
      (workflow) => {
        workflow.on.workflow_dispatch.inputs.extra = {
          type: "string",
          required: true,
        };
      },
    ])
      assert.throws(
        validateOperationalWorkflows.bind(
          null,
          await changeOperational(name, change),
        ),
      );
  }
});

test("Node must be pinned before pure target validation and browsers use root wrappers", async () => {
  for (const name of ["dast", "deployment-smoke", "staging"]) {
    for (const change of [
      (_workflow, job) => {
        [job.steps[1], job.steps[2]] = [job.steps[2], job.steps[1]];
      },
      (_workflow, job) => {
        job.steps[1].with["node-version-file"] = "../other/.nvmrc";
      },
      (_workflow, job) => {
        job.steps[2].run += " || true";
      },
      (_workflow, job) => {
        job.steps[2].run = "echo validate later";
      },
      (_workflow, job) => {
        job.steps[2].shell = "bash {0}; true";
      },
    ])
      assert.throws(
        validateOperationalWorkflows.bind(
          null,
          await changeOperational(name, change),
        ),
      );
  }
  for (const name of ["deployment-smoke", "staging"]) {
    for (const change of [
      (_workflow, job) => {
        job.steps[4].run = "npx playwright install chromium";
      },
      (_workflow, job) => {
        job.steps[5].run = "npx playwright test";
      },
      (_workflow, job) => {
        job.env.PLAYWRIGHT_BROWSERS_PATH = "shared";
      },
      (_workflow, job) => {
        job.steps.at(-1).with.path = "operator-state";
      },
      (_workflow, job) => {
        job.steps.at(-1).if = "always()";
      },
      (_workflow, job) => {
        job.steps.at(-1)["continue-on-error"] = true;
      },
    ])
      assert.throws(
        validateOperationalWorkflows.bind(
          null,
          await changeOperational(name, change),
        ),
      );
  }
});

test("packaging retains independent immutable API input, synthetic build and immutable artifact", async () => {
  for (const change of [
    (_workflow, job) => {
      job.env.KERNEL_SYNTHETIC_ENV = "0";
    },
    (_workflow, job) => {
      delete job.env.WEBSITE_URL;
    },
    (_workflow, job) => {
      job.steps[3].env.KERNEL_API_DIRECTORY = "../kernel-api";
    },
    (_workflow, job) => {
      job.steps[3].run = job.steps[3].run.replace(
        "4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9",
        "main",
      );
    },
    (_workflow, job) => {
      job.steps[3].run += "\ntrue";
    },
    (_workflow, job) => {
      job.steps[4].run += " || true";
    },
    (_workflow, job) => {
      job.steps[5].run = "npm run deploy:package";
    },
    (_workflow, job) => {
      job.steps.at(-1).with["if-no-files-found"] = "warn";
    },
  ])
    assert.throws(
      validateOperationalWorkflows.bind(
        null,
        await changeOperational("package-release", change),
      ),
    );
});

test("CodeQL pins build-free analysis and only its job receives security upload permission", async () => {
  for (const change of [
    (workflow) => {
      workflow.on.push.branches = ["untrusted"];
    },
    (workflow) => {
      workflow.on.pull_request.paths = ["src/**"];
    },
    (workflow) => {
      workflow.on.schedule = [];
    },
    (workflow) => {
      workflow.on.schedule[0].cron = "* * * * *";
    },
    (_workflow, job) => {
      job.permissions.contents = "write";
    },
    (_workflow, job) => {
      job.steps[0].with["persist-credentials"] = true;
    },
    (_workflow, job) => {
      job.steps[1].uses = "github/codeql-action/init@main";
    },
    (_workflow, job) => {
      job.steps[1].with["build-mode"] = "autobuild";
    },
    (_workflow, job) => {
      job.steps[2]["continue-on-error"] = true;
    },
  ])
    assert.throws(
      validateOperationalWorkflows.bind(
        null,
        await changeOperational("codeql", change),
      ),
    );
});

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

const applicationFixture = async () => ({
  workflow: parse(
    await readFile(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    ),
  ),
  applicationManifest: JSON.parse(
    await readFile(
      new URL("../.agents/validation.json", import.meta.url),
      "utf8",
    ),
  ),
});

test("application CI has the full fifteen-check gate and independent Windows build, e2e and visual jobs", async () => {
  const { workflow, applicationManifest } = await applicationFixture();
  assert.ok(["application", "operations"].includes(applicationManifest.phase));
  assert.equal(applicationManifest.applicationReady, true);
  assert.equal(applicationManifest.profiles.full.length, 15);
  assert.deepEqual(Object.keys(workflow.jobs), [
    "check",
    "build",
    "e2e",
    "visual",
  ]);
  assert.doesNotThrow(() =>
    validateCiWorkflow(stringify(workflow), applicationManifest),
  );
});

test("application manifest records each real command owner and rejects missing or invented job ownership", async () => {
  for (const [id, owners] of [
    ["build", ["check", "build", "e2e", "visual"]],
    ["e2e", ["check", "e2e"]],
    ["visual", ["check", "visual"]],
    ["dead-code", ["check"]],
  ]) {
    const { applicationManifest } = await applicationFixture();
    assert.deepEqual(
      applicationManifest.checks.find((entry) => entry.id === id).ciJobs,
      owners,
    );
    for (const ciJobs of [
      undefined,
      [],
      owners.slice(1),
      [...owners, "foreign"],
      [...owners, owners[0]],
    ]) {
      const { workflow, applicationManifest: changed } =
        await applicationFixture();
      changed.checks.find((entry) => entry.id === id).ciJobs = ciJobs;
      assert.throws(
        () => validateCiWorkflow(stringify(workflow), changed),
        /job ownership/,
      );
    }
  }
  for (const [id, ciJobs] of [
    ["build", ["check", "build", "e2e"]],
    ["e2e", ["check", "visual"]],
    ["visual", ["check", "e2e"]],
    ["unit-coverage", ["check", "build"]],
  ]) {
    const { workflow, applicationManifest } = await applicationFixture();
    applicationManifest.checks.find((entry) => entry.id === id).ciJobs = ciJobs;
    assert.throws(
      () => validateCiWorkflow(stringify(workflow), applicationManifest),
      /job ownership/,
    );
  }
});

test("every application job is real, unconditional, fail closed and uses the baseline platform", async () => {
  const changes = [
    (workflow, id) => {
      delete workflow.jobs[id];
    },
    (workflow, id) => {
      workflow.jobs[id].if = "!github.event.pull_request.draft";
    },
    (workflow, id) => {
      workflow.jobs[id]["continue-on-error"] = true;
    },
    (workflow, id) => {
      workflow.jobs[id]["runs-on"] = "ubuntu-latest";
    },
    (workflow, id) => {
      workflow.jobs[id].strategy = { matrix: { include: [] } };
    },
    (workflow, id) => {
      workflow.jobs[id].env = { KERNEL_SYNTHETIC_ENV: "0" };
    },
    (workflow, id) => {
      workflow.jobs[id]["timeout-minutes"] = 0;
    },
    (workflow, id) => {
      workflow.jobs[id].container = "unrelated-image";
    },
    (workflow, id) => {
      workflow.jobs[id].services = {};
    },
    (workflow, id) => {
      workflow.jobs[id].environment = "production";
    },
    (workflow, id) => {
      workflow.jobs[id].permissions = { contents: "write" };
    },
    (workflow, id) => {
      workflow.jobs[id].needs = "unrelated";
    },
  ];
  for (const id of ["check", "build", "e2e", "visual"])
    for (const change of changes) {
      const { workflow, applicationManifest } = await applicationFixture();
      change(workflow, id);
      assert.throws(() =>
        validateCiWorkflow(stringify(workflow), applicationManifest),
      );
    }
});

test("application fixture installation pins public source, owns its directory and preserves each native failure", async () => {
  const changes = [
    (step) => {
      step.run = step.run.replace(
        "4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9",
        "main",
      );
    },
    (step) => {
      step.run = step.run.replace(
        "https://github.com/sepaseh/kernel-api.git",
        "https://example.test/foreign.git",
      );
    },
    (step) => {
      step.run = step.run.replace(
        'npm --prefix "$env:KERNEL_API_DIRECTORY" ci',
        'npm --prefix "$env:KERNEL_API_DIRECTORY" install',
      );
    },
    (step) => {
      step.run = step.run.replace(
        "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
        "# omitted exit propagation",
      );
    },
    (step) => {
      step.run += "\nexit 0\n";
    },
    (step) => {
      step.if = "false";
    },
    (step) => {
      step["continue-on-error"] = true;
    },
    (step) => {
      step.env.KERNEL_API_DIRECTORY = "${{ github.workspace }}/kernel-api";
    },
    (step) => {
      step.env.EXTRA_PRIVATE_INPUT = "synthetic-placeholder";
    },
    (step) => {
      step.shell = "pwsh {0}; exit 0";
    },
  ];
  for (const id of ["check", "build", "e2e", "visual"])
    for (const change of changes) {
      const { workflow, applicationManifest } = await applicationFixture();
      const step = workflow.jobs[id].steps.find((entry) =>
        entry.run?.includes("git clone"),
      );
      change(step);
      assert.throws(() =>
        validateCiWorkflow(stringify(workflow), applicationManifest),
      );
    }
});

test("application browser jobs retain SDK installation and a real same-job build before their checks", async () => {
  for (const id of ["check", "e2e", "visual"])
    for (const change of [
      (steps) =>
        steps.filter((step) => !step.run?.includes("cli.js install chromium")),
      (steps) =>
        steps.map((step) =>
          step.run?.includes("cli.js install chromium")
            ? { ...step, if: "false" }
            : step,
        ),
      (steps) =>
        steps.map((step) =>
          step.run?.includes("cli.js install chromium")
            ? { ...step, run: "npx playwright install chromium || true" }
            : step,
        ),
    ]) {
      const { workflow, applicationManifest } = await applicationFixture();
      workflow.jobs[id].steps = change(workflow.jobs[id].steps);
      assert.throws(() =>
        validateCiWorkflow(stringify(workflow), applicationManifest),
      );
    }
  for (const id of ["e2e", "visual"])
    for (const change of [
      (steps) => steps.filter((step) => step.run !== "npm run build"),
      (steps) =>
        steps.map((step) =>
          step.run === "npm run build" ? { ...step, if: "false" } : step,
        ),
      (steps) => [...steps.slice(0, 5), steps[6], steps[5], steps[7]],
    ]) {
      const { workflow, applicationManifest } = await applicationFixture();
      workflow.jobs[id].steps = change(workflow.jobs[id].steps);
      assert.throws(() =>
        validateCiWorkflow(stringify(workflow), applicationManifest),
      );
    }
});

test("application public inputs, all fifteen manifest owners and bounded evidence cannot be replaced", async () => {
  const changes = [
    (workflow) => {
      delete workflow.env.NPM_CONFIG_INCLUDE;
    },
    (workflow) => {
      workflow.env.API_BASE_URL = "https://api.example.test";
    },
    (workflow) => {
      workflow.env.PLAYWRIGHT_BROWSERS_PATH = "shared";
    },
    (workflow) => {
      workflow.env.KERNEL_SYNTHETIC_ENV = "0";
    },
    (workflow) => {
      workflow.permissions.contents = "write";
    },
    (workflow) => {
      workflow.jobs.foreign = {};
    },
    (workflow) => {
      workflow.jobs.visual.steps.at(-1).with.path = "unowned-state";
    },
    (workflow) => {
      workflow.jobs.e2e.steps.at(-1)["continue-on-error"] = false;
    },
    (workflow) => {
      workflow.jobs.check.steps[0].with.ref = "main";
    },
    (workflow) => {
      workflow.jobs.build.steps[1].uses = "actions/setup-node@main";
    },
  ];
  for (const change of changes) {
    const { workflow, applicationManifest } = await applicationFixture();
    change(workflow);
    assert.throws(() =>
      validateCiWorkflow(stringify(workflow), applicationManifest),
    );
  }
  for (const change of [
    (value) => {
      value.applicationReady = false;
    },
    (value) => {
      value.checks = value.checks.filter((entry) => entry.id !== "e2e");
    },
    (value) => {
      value.profiles.full.pop();
    },
    (value) => {
      value.checks.find((entry) => entry.id === "build").command =
        "npm run typecheck";
    },
    (value) => {
      value.checks.find((entry) => entry.id === "visual").kind = "advisory";
    },
  ]) {
    const { workflow, applicationManifest } = await applicationFixture();
    change(applicationManifest);
    assert.throws(() =>
      validateCiWorkflow(stringify(workflow), applicationManifest),
    );
  }
});
