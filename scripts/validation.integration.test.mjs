import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { validateCiWorkflow } from "./check-ci.mjs";
import { commandArguments } from "./validate.mjs";

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
