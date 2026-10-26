import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { validateCiWorkflow } from "./check-ci.mjs";
import { commandArguments, runProfile } from "./validate.mjs";

test("the current full gate covers every required check once in local and CI execution", () => {
  const read = (file) =>
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const manifest = JSON.parse(read(".agents/validation.json"));
  const publication = JSON.parse(read(".github/bootstrap-policy.json"));
  const pkg = JSON.parse(read("package.json"));
  const required = manifest.checks.filter((check) => check.kind === "required");
  assert.equal(manifest.phase, publication.phase);
  assert.equal(manifest.applicationReady, publication.applicationReady);
  assert.deepEqual(
    manifest.profiles.full,
    required.map((check) => check.id),
  );
  assert.equal(new Set(manifest.profiles.full).size, required.length);
  const commands = required.map((check) => check.command);
  for (const command of commands) {
    const [, script] = commandArguments(command);
    assert.equal(typeof pkg.scripts[script], "string");
  }
  validateCiWorkflow(read(".github/workflows/ci.yml"), manifest);
});
test("validation runner preserves arguments without a shell", () => {
  assert.deepEqual(commandArguments("npm run test:e2e -- --project=chromium"), [
    "run",
    "test:e2e",
    "--",
    "--project=chromium",
  ]);
  assert.deepEqual(
    commandArguments("npm run test -- \"two words\" 'three words'"),
    ["run", "test", "--", "two words", "three words"],
  );
  for (const command of [
    "npm run lint && git push",
    "npm run lint; echo bad",
    "node script.mjs",
    "npm run lint | cat",
    "npm run lint > output",
    "npm run lint $SECRET",
    "npm run test --workspace=other",
    "npm run test --workspaces",
    "npm run test --prefix=../other",
    "npm run --workspaces test",
    "npm run --prefix ../other test",
    "npm run --prefix=../other test",
    "npm run -w other test",
    "npm run test -w other",
    "npm run test -w=other",
    "npm run test -wother",
    "npm run test -C ../other",
    "npm run test --pref=../other",
    "npm run test positional",
  ])
    assert.throws(() => commandArguments(command));
});
test("validation runner accepts script names and forwards root-looking script arguments after the separator", () => {
  for (const script of [
    "test",
    "type-check",
    "test:coverage",
    "_internal",
    "2fa",
  ])
    assert.deepEqual(commandArguments(`npm run ${script}`), ["run", script]);
  assert.deepEqual(
    commandArguments("npm run test -- --prefix=fixture -w value -C fixture"),
    ["run", "test", "--", "--prefix=fixture", "-w", "value", "-C", "fixture"],
  );
});
test("validation profiles stop at the first failed required command", () => {
  const manifest = {
    checks: [
      { id: "first", command: "npm run lint", kind: "required" },
      { id: "second", command: "npm run typecheck", kind: "required" },
    ],
    profiles: { full: ["first", "second"] },
  };
  const seen = [];
  assert.equal(
    runProfile(manifest, "full", (_args, check) => {
      seen.push(check.id);
      return 7;
    }),
    7,
  );
  assert.deepEqual(seen, ["first"]);
  assert.throws(() => runProfile(manifest, "missing", () => 0), /Unknown/);
  assert.throws(
    () =>
      runProfile(
        { ...manifest, profiles: { full: ["unknown"] } },
        "full",
        () => 0,
      ),
    /Unknown validation check/,
  );
});

const profileFixture = () => ({
  checks: [
    { id: "first", command: "npm run lint", kind: "required" },
    { id: "second", command: "npm run typecheck", kind: "required" },
    { id: "optional", command: "npm run advisory", kind: "advisory" },
    { id: "manual", command: "npm run manual", kind: "manual" },
  ],
  profiles: { full: ["first", "second"], focused: ["second"] },
});

test("full validation rejects duplicate, unknown or missing checks before executing any command", () => {
  const cases = [
    (manifest) => manifest.checks.push({ ...manifest.checks[0] }),
    (manifest) => manifest.profiles.full.push("first"),
    (manifest) => manifest.profiles.full.push("unknown"),
    (manifest) => manifest.profiles.full.pop(),
    (manifest) => {
      manifest.checks[0].kind = "unrecognized";
    },
  ];
  for (const change of cases) {
    const manifest = profileFixture();
    change(manifest);
    let executions = 0;
    assert.throws(() =>
      runProfile(manifest, "full", () => {
        executions++;
        return 0;
      }),
    );
    assert.equal(executions, 0);
  }
});

test("manual and advisory checks cannot replace or join required full checks", () => {
  for (const kind of ["manual", "optional"]) {
    for (const ids of [
      ["first", kind],
      ["first", "second", kind],
    ]) {
      const manifest = profileFixture();
      manifest.profiles.full = ids;
      let executions = 0;
      assert.throws(
        () =>
          runProfile(manifest, "full", () => {
            executions++;
            return 0;
          }),
        /every required check/,
      );
      assert.equal(executions, 0);
    }
  }
});

test("focused profiles remain explicit development subsets without reducing the full gate", () => {
  const manifest = profileFixture();
  const seen = [];
  assert.equal(
    runProfile(manifest, "focused", (_args, check) => {
      seen.push(check.id);
      return 0;
    }),
    0,
  );
  assert.deepEqual(seen, ["second"]);
  seen.length = 0;
  assert.equal(
    runProfile(manifest, "full", (_args, check) => {
      seen.push(check.id);
      return 0;
    }),
    0,
  );
  assert.deepEqual(seen, ["first", "second"]);
  manifest.profiles.focused.push("second");
  assert.throws(() => runProfile(manifest, "focused", () => 0), /repeat/);
});

test("the whole selected command plan is parsed before executing its first command", () => {
  const manifest = profileFixture();
  manifest.checks[1].command = "npm run typecheck && echo bypass";
  let executions = 0;
  assert.throws(
    () =>
      runProfile(manifest, "full", () => {
        executions++;
        return 0;
      }),
    /shell operators/,
  );
  assert.equal(executions, 0);
});

test("an invalid inventory or a full profile with no required checks cannot execute", () => {
  const cases = [
    { checks: [] },
    { checks: undefined },
    { checks: [{ id: "", kind: "required" }] },
    { checks: [{ id: " padded ", kind: "required" }] },
    { checks: [{ id: "forged\nsecond", kind: "required" }] },
    {
      checks: [{ id: "manual", command: "npm run manual", kind: "manual" }],
      profiles: { full: ["manual"] },
    },
    { ...profileFixture(), profiles: { full: [] } },
  ];
  for (const manifest of cases) {
    let executions = 0;
    assert.throws(() =>
      runProfile(manifest, "full", () => {
        executions++;
        return 0;
      }),
    );
    assert.equal(executions, 0);
  }
});
