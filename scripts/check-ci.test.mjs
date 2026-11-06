import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  aggregateCommand,
  ciProfiles,
  dastPreflightCommand,
  inspectCi,
  installCommand,
  validateAdditionalWorkflow,
  validateCheckManifest,
  validateCiWorkflow,
  validateDependabot,
  validateSonarWorkflow,
  workflowDocument,
} from "./check-ci.mjs";
import { completePublicationWork } from "./validate-bootstrap.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read(".agents/validation.json"));
const ci = workflowDocument(await read(".github/workflows/ci.yml"));

test("CI executes all sixteen application checks through real runtime jobs and separate coverage producers", async () => {
  await inspectCi();
  validateCheckManifest(manifest);
});

test("CI inspection reports every missing operational workflow after independent reads finish", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kernel-ci-workflows-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await completePublicationWork(
    [
      ".agents/validation.json",
      ".github/bootstrap-policy.json",
      ".github/dependabot.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/codeql.yml",
    ].map(async (filename) => {
      const destination = path.join(root, filename);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, await read(filename));
    }),
  );
  await assert.rejects(inspectCi(root), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(
      error.errors.map((failure) => path.basename(failure.path)),
      [
        "dast.yml",
        "deployment-smoke.yml",
        "package-release.yml",
        "release.yml",
        "staging.yml",
      ],
    );
    return true;
  });
});

test("CI profiles form an exact partition and cannot drop, duplicate or soften a required check", () => {
  for (const change of [
    ...["features", "runners-foundation", "browser-foundation"].map(
      (phase) => (value) => {
        value.phase = phase;
        value.checks.forEach((check) => {
          check.scopes = [phase];
        });
      },
    ),
    (value) => {
      value.applicationReady = false;
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
      value.checks[0].ciJobs = ["check"];
    },
    ...Object.keys(ciProfiles).map(
      (job) => (value) => value.profiles[`ci-${job}`].pop(),
    ),
    (value) => value.profiles["ci-unit"].push("governance-coverage"),
  ]) {
    const value = structuredClone(manifest);
    change(value);
    assert.throws(() => validateCheckManifest(value));
  }
});

test("operations retain all required checks and cannot promote manual work into CI", () => {
  validateCheckManifest(manifest);
  for (const change of [
    (value) => value.checks.pop(),
    (value) => {
      value.checks.at(-1).kind = "manual";
    },
    (value) => {
      value.checks.at(-2).ciJobs = ["build"];
    },
    (value) => value.profiles.full.push("docker"),
    (value) => {
      value.checks.at(-1).command = "npm run build";
    },
    (value) =>
      value.externalWorkflows.push({
        path: ".github/workflows/automatic-deploy.yml",
        mode: "manual",
      }),
  ]) {
    const value = structuredClone(manifest);
    change(value);
    assert.throws(() => validateCheckManifest(value));
  }
  const application = structuredClone(manifest);
  application.phase = "application";
  application.checks = application.checks.filter(
    (check) => check.kind === "required",
  );
  application.checks.forEach((check) => {
    check.scopes = ["application"];
  });
  application.externalWorkflows = application.externalWorkflows.filter(
    (workflow) => workflow.mode !== "manual",
  );
  validateCheckManifest(application);
});

test("operational publication cannot silently dispatch targets or extend write privileges", async () => {
  for (const name of [
    "dast",
    "deployment-smoke",
    "package-release",
    "release",
    "staging",
  ]) {
    const original = workflowDocument(
      await read(`.github/workflows/${name}.yml`),
    );
    validateAdditionalWorkflow(name, JSON.stringify(original));
    for (const change of [
      (value) => {
        value.on.push = { branches: ["main"] };
      },
      (value) => {
        Object.values(value.jobs)[0].if = "true";
      },
      (value) => {
        value.permissions.contents = "write";
      },
      (value) => {
        Object.values(value.jobs)[0].permissions = { contents: "write" };
      },
    ]) {
      const value = structuredClone(original);
      change(value);
      assert.throws(() =>
        validateAdditionalWorkflow(name, JSON.stringify(value)),
      );
    }
  }
  for (const [name, mode] of [
    ["dast", "dast"],
    ["deployment-smoke", "smoke"],
    ["staging", "staging"],
  ]) {
    const value = workflowDocument(await read(`.github/workflows/${name}.yml`));
    const steps = Object.values(value.jobs)[0].steps;
    const index = steps.findIndex(
      (step) =>
        step.run ===
        (name === "dast"
          ? dastPreflightCommand
          : `node scripts/validate-workflow-targets.mjs ${mode}`),
    );
    for (const field of ["if", "continue-on-error"]) {
      const changed = structuredClone(value);
      Object.values(changed.jobs)[0].steps[index][field] =
        field === "if" ? "false" : true;
      assert.throws(() =>
        validateAdditionalWorkflow(name, JSON.stringify(changed)),
      );
    }
    const reordered = structuredClone(value);
    const reorderedSteps = Object.values(reordered.jobs)[0].steps;
    reorderedSteps.splice(index, 0, reorderedSteps.splice(index + 1, 1)[0]);
    assert.throws(() =>
      validateAdditionalWorkflow(name, JSON.stringify(reordered)),
    );
    steps.splice(index, 1);
    assert.throws(() =>
      validateAdditionalWorkflow(name, JSON.stringify(value)),
    );
  }
});

test("DAST cannot validate a different target or omit the exact-origin context", async () => {
  const original = workflowDocument(await read(".github/workflows/dast.yml"));
  for (const change of [
    (job) => {
      job.steps[2].env = { DAST_TARGET: "https://other.example.com" };
    },
    (job) => {
      job.steps[3].env = { DAST_TARGET: "https://other.example.com" };
    },
    (job) => {
      job.steps[3].with.target = "https://other.example.com";
    },
    (job) => {
      job.steps[3].with.cmd_options = "-a";
    },
  ]) {
    const value = structuredClone(original);
    change(value.jobs.zap);
    assert.throws(() =>
      validateAdditionalWorkflow("dast", JSON.stringify(value)),
    );
  }
});

test("producers cannot skip work, run the full gate again, drift actions or mix suite coverage", () => {
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
      value.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      value.concurrency["cancel-in-progress"] = true;
    },
    ...Object.keys(ciProfiles).flatMap((name) => [
      (value) => {
        value.jobs[name].if = "false";
      },
      (value) => {
        value.jobs[name]["continue-on-error"] = true;
      },
      (value) => {
        value.jobs[name].needs = "check";
      },
      (value) => {
        value.jobs[name].steps[0].uses = "actions/checkout@main";
      },
      (value) => {
        value.jobs[name].steps[0].with["persist-credentials"] = true;
      },
      (value) => {
        value.jobs[name].steps[1].with["node-version-file"] = "other";
      },
      (value) => {
        value.jobs[name].steps.find((step) =>
          step.run?.startsWith("npm run validate"),
        ).run = "npm run validate -- full";
      },
    ]),
    (value) => {
      value.jobs.quality.steps[2].run = "npm ci";
    },
    (value) => {
      value.jobs.audit.steps.push({ run: installCommand });
    },
    (value) => {
      value.jobs.unit.steps[4].env.CI_EVIDENCE_SUITE = "governance";
    },
    (value) => {
      value.jobs.unit.steps[4].run = "echo fake-evidence";
    },
    (value) => {
      value.jobs.governance.steps.at(-1).with.path = "coverage/unit";
    },
    (value) => {
      value.jobs.governance.steps.at(-1).if = "false";
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
  for (const value of ["jobs: [", "jobs: {}\njobs: {}", "[]"])
    assert.throws(() => workflowDocument(value));
});

test("application typechecking, measured fonts and runtime acceptance cannot be omitted or moved outside their producer", () => {
  for (const id of [
    "typecheck",
    "font-integrity",
    "dead-code",
    "build",
    "e2e",
    "visual",
  ]) {
    for (const change of [
      (value) => {
        value.checks = value.checks.filter((check) => check.id !== id);
        value.profiles.full = value.profiles.full.filter(
          (check) => check !== id,
        );
      },
      (value) => {
        value.checks.find((check) => check.id === id).kind = "advisory";
      },
      (value) => {
        value.checks.find((check) => check.id === id).scopes = ["foundation"];
      },
      (value) => {
        value.checks.find((check) => check.id === id).ciJobs = ["analysis"];
      },
    ]) {
      const value = structuredClone(manifest);
      change(value);
      assert.throws(() => validateCheckManifest(value));
    }
  }
});

test("application jobs require isolated exact-source builds, installed Chromium and retained browser evidence", () => {
  for (const change of [
    ...["build", "e2e", "visual"].flatMap((mode) => [
      (value) => {
        value.jobs[mode]["runs-on"] = "ubuntu-latest";
      },
      (value) => {
        value.jobs[mode].steps[0].with.ref = "main";
      },
      (value) => {
        value.jobs[mode].steps[1].with["node-version"] = "latest";
      },
      (value) => {
        value.jobs[mode].env = { WEBSITE_URL: "https://production.test" };
      },
      (value) => {
        value.jobs[mode].steps[2].run = "npm ci";
      },
      (value) => {
        value.jobs[mode].steps[3].if = "false";
      },
    ]),
    ...["e2e", "visual"].flatMap((mode) => [
      (value) => {
        value.jobs[mode].needs = [];
      },
      (value) => {
        value.jobs[mode].steps.splice(3, 1);
      },
      (value) => {
        value.jobs[mode].steps[3].run = "npx playwright install chromium";
      },
      (value) => {
        value.jobs[mode].steps[4].run = "echo reuse another job's build";
      },
      (value) => {
        value.jobs[mode].steps[5].env = { WEBSITE_SKIP_BUILD: "1" };
      },
      (value) => {
        value.jobs[mode].steps[5].shell = "sh -c 'exit 0' {0}";
      },
      (value) => {
        value.jobs[mode].steps.at(-1).if = "false";
      },
      (value) => {
        value.jobs[mode].steps.at(-1).with["if-no-files-found"] = "ignore";
      },
      (value) => {
        value.jobs[mode].steps.at(-1).with["include-hidden-files"] = true;
      },
    ]),
    ...[
      "API_BASE_URL",
      "WEBSITE_URL",
      "HOSTNAME",
      "PORT",
      "WEBSITE_INDEXING_ENABLED",
      "KERNEL_SYNTHETIC_ENV",
      "PLAYWRIGHT_BROWSERS_PATH",
    ].map((key) => (value) => {
      delete value.env[key];
    }),
    (value) => {
      value.env.API_BASE_URL = value.env.WEBSITE_URL;
    },
    (value) => {
      value.env.WEBSITE_INDEXING_ENABLED = "true";
    },
    (value) => {
      value.env.PLAYWRIGHT_BROWSERS_PATH = "shared/browser/cache";
    },
    (value) => {
      value.env.TOKEN = "synthetic-forbidden";
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
});

test("font coverage uses pinned Python and dependencies before measuring and sharing the same producer artifact", () => {
  for (const change of [
    (value) => {
      value.jobs.governance.steps.splice(3, 1);
    },
    (value) => {
      value.jobs.governance.steps[3].uses = "actions/setup-python@main";
    },
    (value) => {
      value.jobs.governance.steps[3].with["python-version"] = "3.x";
    },
    (value) => {
      value.jobs.governance.steps[4].run = "echo skip dependencies";
    },
    ...[" --require-hashes", " --only-binary :all:"].map(
      (option) => (value) => {
        const install = value.jobs.governance.steps[4];
        install.run = install.run.replace(option, "");
      },
    ),
    (value) => {
      value.jobs.governance.steps[4].if = "false";
    },
    (value) => {
      [value.jobs.governance.steps[4], value.jobs.governance.steps[5]] = [
        value.jobs.governance.steps[5],
        value.jobs.governance.steps[4],
      ];
    },
    (value) => {
      value.jobs.governance.steps.at(-1).with.path =
        "coverage/governance/lcov.info\ncoverage/governance/ci-evidence.json\n";
    },
    (value) => {
      value.jobs.governance.steps.at(-1).with.path +=
        "coverage/fonts/coverage.xml\n";
    },
    (value) => {
      value.jobs.analysis.steps.splice(-1, 0, { run: "npm run check:fonts" });
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
});

test("main pushes cannot filter paths or skip governance verification", () => {
  for (const field of ["paths", "paths-ignore"]) {
    const value = structuredClone(ci);
    value.on.push[field] = ["docs/**"];

    assert.throws(
      () => validateCiWorkflow(JSON.stringify(value), manifest),
      /Main pushes must run without additional filters/,
    );
  }
});

test("CI requires explicit pull request activities including ready for review", () => {
  for (const event of [null, {}]) {
    const value = structuredClone(ci);
    value.on.pull_request = event;
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
  const value = structuredClone(ci);
  value.on.pull_request.types = value.on.pull_request.types.filter(
    (activity) => activity !== "ready_for_review",
  );
  assert.throws(
    () => validateCiWorkflow(JSON.stringify(value), manifest),
    /Required PR activity is missing/,
  );
});

test("CI rejects scalar pull request activity types even when all required names occur", () => {
  const value = structuredClone(ci);
  value.on.pull_request.types = "opened,synchronize,reopened,ready_for_review";

  assert.throws(
    () => validateCiWorkflow(JSON.stringify(value), manifest),
    /PR activity types must be an array/,
  );
});

test("verification producers cannot change the run directory through job defaults", () => {
  for (const name of Object.keys(ciProfiles)) {
    const value = structuredClone(ci);
    value.jobs[name].defaults = { run: { "working-directory": "other" } };

    assert.throws(
      () => validateCiWorkflow(JSON.stringify(value), manifest),
      /Verification jobs cannot override run defaults/,
      name,
    );
  }
});

test("aggregate cannot omit failed or skipped producers or rerun validation", () => {
  for (const change of [
    (value) => {
      value.jobs.check.if = "success()";
    },
    (value) => {
      value.jobs.check.needs.pop();
    },
    (value) => {
      value.jobs.check["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.check.permissions.contents = "write";
    },
    (value) => {
      value.jobs.check.steps[0].env.CI_NEEDS = "{}";
    },
    (value) => {
      value.jobs.check.steps[0].run = "echo success";
    },
    (value) => {
      value.jobs.check.steps.push({ run: "npm run validate -- full" });
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateCiWorkflow(JSON.stringify(value), manifest));
  }
});

test("aggregate execution cannot be replaced through defaults or a custom shell", () => {
  for (const change of [
    (value) => {
      value.jobs.check.defaults = { run: { shell: "sh -c 'exit 0' {0}" } };
    },
    (value) => {
      value.jobs.check.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      value.jobs.check.steps[0].shell = "sh -c 'exit 0' {0}";
    },
    (value) => {
      value.defaults = { run: { shell: "sh -c 'exit 0' {0}" } };
    },
  ]) {
    const value = structuredClone(ci);
    change(value);

    assert.throws(
      () => validateCiWorkflow(JSON.stringify(value), manifest),
      /cannot override/,
    );
  }
});

test("verification and analysis jobs inherit the workflow permissions without overrides", () => {
  for (const name of [...Object.keys(ciProfiles), "analysis"]) {
    for (const permissions of [
      { contents: "write" },
      "write-all",
      { contents: "read" },
      {},
      null,
    ]) {
      const value = structuredClone(ci);
      value.jobs[name].permissions = permissions;
      const content = JSON.stringify(value);

      assert.throws(
        () => validateCiWorkflow(content, manifest),
        /inherit workflow permissions/,
        name,
      );
      if (name === "analysis")
        assert.throws(
          () => validateSonarWorkflow(content),
          /inherit workflow permissions/,
        );
    }
  }
});

test("actual aggregate command succeeds only for every successful producer", () => {
  const script = aggregateCommand.slice('node -e "'.length, -1);
  const healthy = Object.fromEntries(
    Object.keys(ciProfiles).map((job) => [job, { result: "success" }]),
  );
  const run = (needs) =>
    spawnSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      env: { CI_NEEDS: JSON.stringify(needs) },
      windowsHide: true,
    });
  assert.equal(run(healthy).status, 0);
  for (const job of Object.keys(ciProfiles)) {
    for (const result of ["failure", "cancelled", "skipped", undefined]) {
      const needs = structuredClone(healthy);
      needs[job].result = result;
      assert.equal(run(needs).status, 1);
    }
    const missing = structuredClone(healthy);
    delete missing[job];
    assert.equal(run(missing).status, 1);
  }
});

test("Sonar requires both real suite artifacts and their own producer attempts without rerunning tests", () => {
  for (const change of [
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      value.defaults = { run: { shell: "sh -c 'exit 0' {0}" } };
    },
    (value) => {
      value.jobs.analysis.name = "fake";
    },
    (value) => {
      value.jobs.analysis.defaults = {
        run: { shell: "sh -c 'exit 0' {0}" },
      };
    },
    (value) => {
      value.jobs.analysis.defaults = {
        run: { "working-directory": "other" },
      };
    },
    (value) => {
      value.jobs.analysis.if = "false";
    },
    (value) => {
      delete value.jobs.analysis.if;
    },
    (value) => {
      value.jobs.analysis.needs = ["unit", "governance"];
    },
    (value) => {
      value.jobs.analysis.steps.reverse();
    },
    ...[2, 4, 6, 7].map((index) => (value) => {
      value.jobs.analysis.steps[index].shell = "sh -c 'exit 0' {0}";
    }),
    ...[3, 5].flatMap((index) => [
      (value) => {
        value.jobs.analysis.steps[index].with.name = "foreign-artifact";
      },
      (value) => {
        value.jobs.analysis.steps[index].with["digest-mismatch"] = "warn";
      },
      (value) => {
        value.jobs.analysis.steps[index + 1].env.CI_EVIDENCE_PRODUCER_ATTEMPT =
          "${{ github.run_attempt }}";
      },
      (value) => {
        value.jobs.analysis.steps[index + 1].run = "npm run test:unit";
      },
    ]),
    (value) => {
      value.jobs.analysis.steps[6].env.CI_EVIDENCE_SUITE = "unit";
    },
    (value) => {
      value.jobs.analysis.steps[7].run = "npm ci";
    },
    (value) => {
      value.jobs.analysis.steps.at(-1).env.SONAR_TOKEN = "literal-token";
    },
    (value) => {
      value.jobs.analysis.steps.at(-1).with.args = "";
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm run build" });
    },
  ]) {
    const value = structuredClone(ci);
    change(value);
    assert.throws(() => validateSonarWorkflow(JSON.stringify(value)));
  }
});

test("CodeQL covers every pull request base without path or activity filtering", async () => {
  const original = workflowDocument(await read(".github/workflows/codeql.yml"));
  for (const event of [null, {}]) {
    const value = structuredClone(original);
    value.on.pull_request = event;
    validateAdditionalWorkflow("codeql", JSON.stringify(value));
  }
  for (const field of [
    "branches",
    "branches-ignore",
    "paths",
    "paths-ignore",
    "types",
  ]) {
    const value = structuredClone(original);
    value.on.pull_request = { [field]: ["main"] };
    assert.throws(() =>
      validateAdditionalWorkflow("codeql", JSON.stringify(value)),
    );
  }
});

test("CodeQL retains exact permissions and real security analysis", async () => {
  const original = workflowDocument(await read(".github/workflows/codeql.yml"));
  for (const change of [
    (value) => {
      value.jobs.analyze.if = "false";
    },
    ...[0, 1, 2].map((index) => (value) => {
      value.jobs.analyze.steps[index].if = "false";
    }),
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      value.jobs.analyze.permissions["security-events"] = "read";
    },
    (value) => {
      value.jobs.analyze.steps[1].with.queries = "default";
    },
    (value) => {
      value.jobs.analyze.steps[1].with.languages = "javascript-typescript";
    },
    (value) => {
      value.jobs.analyze.steps[1].with["build-mode"] = "none";
    },
    (value) => {
      value.jobs.analyze.steps[2].with = { upload: "never" };
    },
  ]) {
    const value = structuredClone(original);
    change(value);
    assert.throws(() =>
      validateAdditionalWorkflow("codeql", JSON.stringify(value)),
    );
  }
  assert.throws(() =>
    validateAdditionalWorkflow("review-signal", JSON.stringify(original)),
  );
});

test("CodeQL analysis cannot declare job dependencies", async () => {
  const original = workflowDocument(await read(".github/workflows/codeql.yml"));
  for (const needs of ["prerequisite", ["prerequisite"]]) {
    const value = structuredClone(original);
    value.jobs.analyze.needs = needs;

    assert.throws(
      () => validateAdditionalWorkflow("codeql", JSON.stringify(value)),
      /CodeQL analysis cannot depend on other jobs/,
    );
  }
});

test("CodeQL cannot add an unreviewed job with a write token", async () => {
  const value = workflowDocument(await read(".github/workflows/codeql.yml"));
  value.jobs.extra = {
    "runs-on": "ubuntu-latest",
    permissions: { contents: "write" },
    steps: [{ run: "echo extra job" }],
  };

  assert.throws(
    () => validateAdditionalWorkflow("codeql", JSON.stringify(value)),
    /Only the reviewed CodeQL analysis job is permitted/,
  );
});

test("CodeQL checkout cannot analyze a different revision, repository or source subset", async () => {
  const original = workflowDocument(await read(".github/workflows/codeql.yml"));
  for (const change of [
    (inputs) => {
      inputs.ref = "main";
    },
    (inputs) => {
      delete inputs.ref;
    },
    (inputs) => {
      inputs.repository = "other/repository";
    },
    (inputs) => {
      inputs.path = "other";
    },
    (inputs) => {
      inputs["sparse-checkout"] = "scripts";
    },
  ]) {
    const value = structuredClone(original);
    change(value.jobs.analyze.steps[0].with);

    assert.throws(
      () => validateAdditionalWorkflow("codeql", JSON.stringify(value)),
      /CodeQL must use the exact current-revision checkout inputs/,
    );
  }
});

test("Dependabot schedules grouped weekly npm and Actions version updates with bounded PR limits", async () => {
  const original = workflowDocument(await read(".github/dependabot.yml"));
  validateDependabot(JSON.stringify(original));
  for (const change of [
    (value) => {
      value.updates.pop();
    },
    ...[0, 1].map((index) => (value) => {
      value.updates[index].ignore = [{ "dependency-name": "*" }];
    }),
    (value) => {
      value.updates[0]["exclude-paths"] = ["**"];
    },
    (value) => {
      value.updates[0]["open-pull-requests-limit"] = 0;
    },
    (value) => {
      value.updates[1]["open-pull-requests-limit"] = 0;
    },
    (value) => {
      value.updates[0].schedule.interval = "daily";
    },
    (value) => {
      delete value.updates[0].groups;
    },
    (value) => {
      value.updates[1].groups["actions-minor-and-patch"]["update-types"].push(
        "major",
      );
    },
  ]) {
    const changed = structuredClone(original);
    change(changed);
    assert.throws(() => validateDependabot(JSON.stringify(changed)));
  }
});
