import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { parseEnv } from "node:util";

import {
  commandEnvironment,
  markedCliFixture,
  temporaryFixture,
} from "./deployment.test-support.mjs";
import {
  validateDeploymentEnv,
  validateOrigin,
} from "./validate-deployment-env.mjs";

test("website SEO stays backward-compatible and accepts explicit canonical origins", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const values of [
    {},
    { WEBSITE_URL: "" },
    { WEBSITE_INDEXING_ENABLED: "false" },
    { WEBSITE_URL: "https://WWW.Kernel.test:443/" },
    {
      WEBSITE_URL: "https://127.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    },
    { WEBSITE_URL: "http://localhost:3001", WEBSITE_INDEXING_ENABLED: "false" },
    { WEBSITE_URL: "http://preview.localhost:3001/" },
    { WEBSITE_URL: "http://127.12.34.56:3001" },
    { WEBSITE_URL: "http://127.1:3001" },
    { WEBSITE_URL: "http://[::1]:3001" },
    { WEBSITE_URL: "http://[::ffff:127.0.0.1]:3001" },
    {
      WEBSITE_URL: "https://www.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    },
  ])
    assert.doesNotThrow(() =>
      validateDeploymentEnv("website", { ...base, ...values }),
    );
});

test("website CSP defaults to report-only, accepts enforcement and rejects invalid rollout modes", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const WEBSITE_CSP_MODE of [undefined, "report-only", "enforce"])
    assert.doesNotThrow(() =>
      validateDeploymentEnv("website", { ...base, WEBSITE_CSP_MODE }),
    );
  for (const WEBSITE_CSP_MODE of [
    "",
    "off",
    "ENFORCE",
    "enforced",
    " report-only ",
  ])
    assert.throws(
      () => validateDeploymentEnv("website", { ...base, WEBSITE_CSP_MODE }),
      /WEBSITE_CSP_MODE/,
    );
});

test("website SEO rejects accidental indexing and malformed canonical origins", () => {
  const base = { NODE_ENV: "production", API_BASE_URL: "http://api:3000" };
  for (const values of [
    { WEBSITE_INDEXING_ENABLED: "true" },
    { WEBSITE_URL: "", WEBSITE_INDEXING_ENABLED: "true" },
    { WEBSITE_INDEXING_ENABLED: "" },
    { WEBSITE_INDEXING_ENABLED: "TRUE" },
    { WEBSITE_INDEXING_ENABLED: "1" },
    { WEBSITE_INDEXING_ENABLED: " true " },
    { WEBSITE_URL: "http://www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test/page" },
    { WEBSITE_URL: "https://www.kernel.test/?" },
    { WEBSITE_URL: "https://www.kernel.test/#" },
    { WEBSITE_URL: "https://www.kernel.test?q=1" },
    { WEBSITE_URL: "https://user:password@www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test\\other" },
    { WEBSITE_URL: " https://www.kernel.test" },
    { WEBSITE_URL: "https://www.kernel.test\n" },
    { WEBSITE_URL: "https://www.kernel.test\u0000" },
    { WEBSITE_URL: "https://www.kernel.test\u007f" },
    { WEBSITE_URL: "https://www.kernel.test\uFEFF" },
    { WEBSITE_URL: "http://127.kernel.test" },
    { WEBSITE_URL: "file:///tmp/site" },
    ...[
      "localhost",
      "preview.localhost.",
      "127.12.34.56",
      "127.1",
      "[::1]",
      "[::ffff:127.0.0.1]",
    ].flatMap((hostname) =>
      ["http", "https"].map((scheme) => ({
        WEBSITE_URL: `${scheme}://${hostname}:3001`,
        WEBSITE_INDEXING_ENABLED: "true",
      })),
    ),
  ])
    assert.throws(() =>
      validateDeploymentEnv("website", { ...base, ...values }),
    );
  assert.throws(() =>
    validateDeploymentEnv("website", {
      ...base,
      NODE_ENV: "development",
      WEBSITE_URL: "https://www.kernel.test",
      WEBSITE_INDEXING_ENABLED: "true",
    }),
  );
});

test("public origins cannot inject nginx fields, credentials or non-origin URL parts", () => {
  for (const invalid of [
    "https://user:private@kernel.test",
    "https://kernel.test/extra",
    "https://kernel.test?q=1",
    "https://kernel.test#hash",
    "https://kernel.test/",
    "https://kernel.test\n;return 200;",
    "file:///tmp/file",
  ]) {
    assert.throws(() => validateOrigin(invalid));
  }
});

test("deployment validation CLI refuses a false phase before runtime settings", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const result = spawnSync(
    process.execPath,
    [path.join(directory, "scripts/validate-deployment-env.mjs"), "website"],
    {
      env: commandEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stderr,
    /applicationReady|non-runnable|runnable application/i,
  );
  assert.doesNotMatch(
    result.stderr,
    /ENOENT|fetch failed|API_BASE_URL is required/,
  );
});

test("public website examples satisfy validation without operator environment", async () => {
  await Promise.all(
    [
      new URL("../.env.example", import.meta.url),
      new URL("../deploy/docker/compose.env.example", import.meta.url),
      new URL("../deploy/native/website.env.example", import.meta.url),
    ].map(async (filename) => {
      const values = parseEnv(await readFile(filename, "utf8"));
      assert.doesNotThrow(() =>
        validateDeploymentEnv("website", { NODE_ENV: "production", ...values }),
      );
    }),
  );
});
