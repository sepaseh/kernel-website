import assert from "node:assert/strict";
import childProcess from "node:child_process";
import path from "node:path";

import { apiFixtureRevision } from "./runner-inputs.mjs";

export function apiGitMock(
  directory,
  control = { top: directory, revision: apiFixtureRevision, changes: "" },
  calls = [],
) {
  return (command, args, options, callback) => {
    assert.equal(
      command,
      process.platform === "win32"
        ? "C:\\Program Files\\Git\\cmd\\git.exe"
        : "/usr/bin/git",
    );
    assert.deepEqual(args.slice(0, 6), [
      "--no-optional-locks",
      "--no-replace-objects",
      "-C",
      directory,
      "-c",
      "core.fsmonitor=false",
    ]);
    calls.push({ command, args, options });
    const operation = args.slice(6).join(" ");
    const output =
      operation === "rev-parse --show-toplevel"
        ? control.top
        : operation === "rev-parse HEAD"
          ? control.revision
          : control.changes;
    callback(control.error, `${output}\n`, "");
  };
}

// Owned fake API code and Git replies exercise the consumer boundary without
// installing or starting the independently published API during governance tests.
export async function createApiFixture(
  t,
  put,
  directory,
  program = "// Owned fake API entry.\n",
) {
  const prefix = path.basename(directory);
  const manifest = {
    name: "kernel-api",
    type: "module",
    dependencies: { "owned-api-runtime": "1.0.0" },
  };
  await put(`${prefix}/package.json`, JSON.stringify(manifest));
  await put(
    `${prefix}/package-lock.json`,
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": manifest,
        "node_modules/owned-api-runtime": { version: "1.0.0" },
      },
    }),
  );
  await put(
    `${prefix}/node_modules/owned-api-runtime/package.json`,
    JSON.stringify({ name: "owned-api-runtime", version: "1.0.0" }),
  );
  await put(`${prefix}/src/index.ts`, program);
  await put(`${prefix}/.git/HEAD`, "Owned mocked Git identity.\n");
  const control = {
    top: directory,
    revision: apiFixtureRevision,
    changes: "",
    error: undefined,
  };
  const calls = [];
  t.mock.method(
    childProcess,
    "execFile",
    apiGitMock(directory, control, calls),
  );
  return { control, calls, manifest };
}
