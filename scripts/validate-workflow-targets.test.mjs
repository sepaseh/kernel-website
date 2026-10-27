import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseConfiguredHostname,
  parseTarget,
  validateDastTarget,
  validateSmokeTargets,
  validateStagingTargets,
  validateWorkflowTargets,
} from "./validate-workflow-targets.mjs";

const staging = {
  STAGING_ALLOWED_API_HOST: "api.staging.example.com",
  STAGING_ALLOWED_APP_HOST: "staging.example.com",
  STAGING_API_HEALTH_URL: "http://api.staging.example.com/health",
  STAGING_BASE_URL: "http://staging.example.com/app/",
};

const smoke = {
  SMOKE_ALLOWED_API_HOST: staging.STAGING_ALLOWED_API_HOST,
  SMOKE_ALLOWED_APP_HOST: staging.STAGING_ALLOWED_APP_HOST,
  SMOKE_API_HEALTH_URL: staging.STAGING_API_HEALTH_URL,
  SMOKE_BASE_URL: staging.STAGING_BASE_URL,
  SMOKE_DEPLOYMENT_ID: "candidate-0123456789",
  SMOKE_EXPECTED_DEPLOYMENT_ID: "candidate-0123456789",
};

const dast = {
  DAST_ALLOWED_HOST: "staging.example.com",
  DAST_PRODUCTION_HOST: "example.com",
  DAST_TARGET: "http://staging.example.com",
};

test("configured hosts are canonical DNS names with bounded labels", () => {
  assert.equal(parseConfiguredHostname("HOST", "EXAMPLE.COM"), "example.com");
  assert.equal(
    parseConfiguredHostname("HOST", `${"a".repeat(63)}.test`),
    `${"a".repeat(63)}.test`,
  );
  for (const host of [
    undefined,
    null,
    42,
    {},
    "",
    " example.com",
    "example.com ",
    "example.com:443",
    "http://example.com",
    "-bad.example",
    "bad-.example",
    "bad..example",
    "example.com.",
    "under_score.test",
    `${"a".repeat(64)}.test`,
    `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`,
    "127.1",
    "2130706433",
    "0x7f000001",
    "[::1]",
  ])
    assert.throws(() => parseConfiguredHostname("HOST", host), /HOST/);
});

test("targets retain explicit paths and ports but reject credentials and URL normalization tricks", () => {
  const target = parseTarget(
    "TARGET",
    "HTTPS://STAGING.EXAMPLE.COM:444/app/?next=%2Faccount#ready",
  );
  assert.equal(target.hostname, "staging.example.com");
  assert.equal(target.port, "444");
  assert.equal(target.pathname, "/app/");
  assert.equal(target.search, "?next=%2Faccount");
  for (const value of [
    undefined,
    null,
    42,
    {},
    "",
    "http://user:pass@example.com",
    "file:///tmp/file",
    "ftp://example.com",
    "https:example.com",
    "https:/example.com",
    "https://example.com\\login",
    "https://example.com\n",
    "https://example.com/\u0000",
    "https://example.com/\u007f",
    " https://example.com",
  ])
    assert.throws(() => parseTarget("TARGET", value));
});

test("staging validates both explicit hosts without making requests", () => {
  assert.doesNotThrow(() => validateStagingTargets(staging));
  for (const [field, value] of [
    ["STAGING_BASE_URL", "http://other.example.com"],
    ["STAGING_API_HEALTH_URL", "http://other.example.com/health"],
    ["STAGING_BASE_URL", "https://staging.example.com.attacker.test"],
  ])
    assert.throws(
      () => validateStagingTargets({ ...staging, [field]: value }),
      new RegExp(`${field} host is not explicitly allowed`),
    );
  for (const field of Object.keys(staging)) {
    const incomplete = { ...staging };
    delete incomplete[field];
    assert.throws(() => validateStagingTargets(incomplete), new RegExp(field));
  }
});

test("smoke targets require matching deployment IDs and report smoke field names", () => {
  assert.doesNotThrow(() => validateSmokeTargets(smoke));
  assert.throws(
    () =>
      validateSmokeTargets({ ...smoke, SMOKE_EXPECTED_DEPLOYMENT_ID: "other" }),
    /expected deployment/,
  );
  for (const field of ["SMOKE_DEPLOYMENT_ID", "SMOKE_EXPECTED_DEPLOYMENT_ID"]) {
    const incomplete = { ...smoke };
    delete incomplete[field];
    assert.throws(
      () => validateSmokeTargets(incomplete),
      /SMOKE_DEPLOYMENT_ID and SMOKE_EXPECTED_DEPLOYMENT_ID/,
    );
  }
  for (const invalid of [42, {}, true, " candidate", "candidate "])
    assert.throws(
      () =>
        validateSmokeTargets({
          ...smoke,
          SMOKE_DEPLOYMENT_ID: invalid,
          SMOKE_EXPECTED_DEPLOYMENT_ID: invalid,
        }),
      /SMOKE_DEPLOYMENT_ID and SMOKE_EXPECTED_DEPLOYMENT_ID/,
    );
  for (const [field, value] of [
    ["SMOKE_BASE_URL", "http://other.example.com"],
    ["SMOKE_API_HEALTH_URL", "http://other.example.com/health"],
    ["SMOKE_ALLOWED_APP_HOST", "invalid host"],
  ])
    assert.throws(
      () => validateSmokeTargets({ ...smoke, [field]: value }),
      new RegExp(field),
    );
});

test("DAST requires a distinct explicitly allowed staging host", () => {
  assert.doesNotThrow(() => validateDastTarget(dast));
  assert.throws(
    () =>
      validateDastTarget({ ...dast, DAST_TARGET: "http://other.example.com" }),
    /not explicitly allowed/,
  );
  assert.throws(
    () =>
      validateDastTarget({
        ...dast,
        DAST_ALLOWED_HOST: "example.com",
        DAST_TARGET: "http://example.com",
      }),
    /must not target the production host/,
  );
  assert.throws(
    () => validateDastTarget({ ...dast, DAST_ALLOWED_HOST: "bad host" }),
    /DAST_ALLOWED_HOST/,
  );
  assert.throws(
    () => validateDastTarget({ ...dast, DAST_PRODUCTION_HOST: "" }),
    /PRODUCTION_HOST/,
  );
});

test("mode selection fails closed for missing and inherited object names", () => {
  assert.doesNotThrow(() => validateWorkflowTargets("staging", staging));
  assert.doesNotThrow(() => validateWorkflowTargets("smoke", smoke));
  assert.doesNotThrow(() => validateWorkflowTargets("dast", dast));
  for (const mode of [
    undefined,
    "",
    "other",
    "constructor",
    "toString",
    "__proto__",
  ])
    assert.throws(
      () => validateWorkflowTargets(mode, staging),
      /Expected validation mode/,
    );
});

test("CLI uses only supplied synthetic target values and rejects extra arguments", () => {
  const script = fileURLToPath(
    new URL("./validate-workflow-targets.mjs", import.meta.url),
  );
  const environment = Object.fromEntries(
    ["SystemRoot", "WINDIR", "PATH", "Path"].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
  const run = (args, values = staging) =>
    spawnSync(process.execPath, [script, ...args], {
      env: { ...environment, ...values },
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
  assert.equal(run(["staging"]).status, 0);
  assert.equal(run(["smoke"], smoke).status, 0);
  assert.equal(run(["dast"], dast).status, 0);
  for (const args of [[], ["constructor"], ["staging", "extra"]]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.error, undefined);
  }
  assert.match(run(["staging"], {}).stderr, /STAGING_BASE_URL is required/);
});
