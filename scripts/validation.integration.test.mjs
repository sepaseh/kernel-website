import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { validateCiWorkflow } from "./check-ci.mjs";
import { commandArguments } from "./validate.mjs";

test("the full profile and CI declare every required check once with its expected script body", () => {
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
  const expectedScripts = {
    audit: "node scripts/run-audit.mjs",
    "check:actions": "node scripts/run-actionlint.mjs",
    "check:boundaries": "node scripts/check-boundaries.mjs",
    "check:ci": "node scripts/check-ci.mjs",
    "check:fonts":
      "node -e \"for (const folder of ['fonts', 'governance']) require('node:fs').mkdirSync('coverage/' + folder, { recursive: true })\" && python -m coverage run --data-file=coverage/fonts/.coverage --branch --source=scripts scripts/subset-website-fonts.py --check && python -m coverage xml --data-file=coverage/fonts/.coverage -o coverage/governance/font-coverage.xml && python -m coverage report --data-file=coverage/fonts/.coverage --fail-under=80",
    "check:guidance": "node scripts/check-guidance.mjs",
    "check:snapshot": "node scripts/validate-bootstrap.mjs",
    "format:check": "prettier . --check",
    lint: 'eslint . --ignore-pattern ".next/**" --ignore-pattern "test-results/**" --ignore-pattern "playwright-report/**" --ignore-pattern "*.tsbuildinfo"',
    "test:governance":
      "node -e \"require('node:fs').mkdirSync('coverage/governance', { recursive: true })\" && node --experimental-test-coverage --test-coverage-exclude=**/*.test.mjs --test-coverage-lines=80 --test-coverage-functions=80 --test-coverage-branches=80 --test --test-reporter=spec --test-reporter=lcov --test-reporter-destination=stdout --test-reporter-destination=coverage/governance/lcov.info scripts/analyze-website-performance.test.mjs scripts/block-dangerous-shell.test.mjs scripts/block-dangerous.test.mjs scripts/check-boundaries.test.mjs scripts/check-ci.test.mjs scripts/check-guidance.test.mjs scripts/ci-evidence.test.mjs scripts/dependency-toolchain.test.mjs scripts/healthcheck.test.mjs scripts/package-release.test.mjs scripts/post-edit-format.test.mjs scripts/prepare-standalone.test.mjs scripts/quality-gate.test.mjs scripts/release-files.test.mjs scripts/render-deployment.test.mjs scripts/run-actionlint.test.mjs scripts/runner-inputs.test.mjs scripts/runner-process.test.mjs scripts/start-website.test.mjs scripts/test-website-api.test.mjs scripts/test-website-server.test.mjs scripts/validate-bootstrap.test.mjs scripts/validate-deployment-env.test.mjs scripts/validate-gateway-env.test.mjs scripts/validate.test.mjs scripts/validation.integration.test.mjs scripts/website-api-fixture.test.mjs scripts/website-entrypoint.test.mjs scripts/website-performance-environment.test.mjs",
    "test:unit": "vitest run --coverage",
    typecheck: "tsc --noEmit -p tsconfig.json",
  };
  const commands = required.map((check) => check.command);
  for (const command of commands) {
    const [, script] = commandArguments(command);
    assert.ok(Object.hasOwn(expectedScripts, script));
    assert.equal(pkg.scripts[script], expectedScripts[script]);
  }
  assert.equal(commands.length, Object.keys(expectedScripts).length);
  validateCiWorkflow(read(".github/workflows/ci.yml"), manifest);
});
