import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  commandEnvironment,
  markedCliFixture,
  temporaryFixture,
} from "./deployment.test-support.mjs";

test("website entrypoint parses and enforces readiness before exec", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, false);
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  const entrypoint = path.join(directory, "website-entrypoint.sh");
  await copyFile(
    new URL("../deploy/docker/website-entrypoint.sh", import.meta.url),
    entrypoint,
  );
  const checked = spawnSync(bash, ["--noprofile", "--norc", "-n", entrypoint], {
    env: commandEnvironment(),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(checked.error, undefined);
  assert.equal(checked.status, 0, checked.stderr);
  const marker = path.join(directory, "executed.txt");
  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      entrypoint,
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync(process.argv[1], 'must not execute')",
      marker,
    ],
    {
      cwd: directory,
      env: commandEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /applicationReady|non-runnable|runnable application/i,
  );
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

test("website entrypoint executes the supplied command after a synthetic ready preflight", async (context) => {
  const directory = await temporaryFixture(context);
  await markedCliFixture(directory, true);
  const bash =
    process.platform === "win32"
      ? "C:/Program Files/Git/bin/bash.exe"
      : "/bin/bash";
  const entrypoint = path.join(directory, "website-entrypoint.sh");
  await copyFile(
    new URL("../deploy/docker/website-entrypoint.sh", import.meta.url),
    entrypoint,
  );
  const marker = path.join(directory, "executed.txt");

  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      entrypoint,
      process.execPath,
      "-e",
      "require('node:fs').writeFileSync(process.argv[1], process.argv[2])",
      marker,
      "synthetic command argument with spaces",
    ],
    {
      cwd: directory,
      env: {
        ...commandEnvironment(),
        NODE_ENV: "production",
        API_BASE_URL: "https://api.kernel.test",
      },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Deployment configuration is valid\./);
  assert.equal(
    await readFile(marker, "utf8"),
    "synthetic command argument with spaces",
  );
});
