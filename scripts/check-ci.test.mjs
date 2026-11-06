import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  aggregateCommand,
  ciProfiles,
  inspectCi,
  installCommand,
  validateAdditionalWorkflow,
  validateCheckManifest,
  validateCiWorkflow,
  validateDependabot,
  validateSonarWorkflow,
  workflowDocument,
} from "./check-ci.mjs";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(await read(".agents/validation.json"));
const ci = workflowDocument(await read(".github/workflows/ci.yml"));

test("CI executes all twelve browser foundation checks once through separate visible jobs and real coverage producers", async () => {
  await inspectCi();
  validateCheckManifest(manifest);
});

test("CI profiles form an exact partition and cannot drop, duplicate or soften a required check", () => {
  for (const change of [
    ...["features", "runners-foundation", "application"].map(
      (phase) => (value) => {
        value.phase = phase;
        value.checks.forEach((check) => {
          check.scopes = [phase];
        });
      },
    ),
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

test("browser foundation typechecking and measured font integrity cannot be omitted or moved outside their producer", () => {
  for (const id of ["typecheck", "font-integrity"]) {
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
