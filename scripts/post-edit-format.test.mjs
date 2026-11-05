import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  bash,
  fixture,
  hooks,
  runShell,
  runtimeEnvironment,
} from "./hook.test-support.mjs";

const hostPath = (filename) => {
  const result = spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      'if command -v cygpath >/dev/null 2>&1; then cygpath -u "$1"; elif command -v wslpath >/dev/null 2>&1; then wslpath -u "$1"; else printf "%s\\n" "$1"; fi',
      "post-edit-host-path",
      filename,
    ],
    {
      env: runtimeEnvironment(),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

test("native Node paths preserve post-edit behavior and empty input fails closed", () => {
  const postEdit = path.join(hooks, "post-edit-format.sh");
  assert.equal(
    runShell({ file_path: "README.md" }, postEdit, false, true).status,
    0,
  );
  assert.equal(runShell("", postEdit, false, true).status, 2);
});

test("post-edit helper fails closed when Node is unavailable", () => {
  const result = runShell(
    { command: "npm run typecheck" },
    path.join(hooks, "post-edit-format.sh"),
    true,
  );
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /requires Node\.js/);
});

test("post-edit helper passes only the selected in-project file to installed ESLint", async (t) => {
  const { root, script } = await fixture(t, "post-edit-format.sh");
  await mkdir(path.join(root, "node_modules/eslint/bin"), { recursive: true });
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(path.join(root, "src/edited.ts"), "const edited = true;\n");
  await writeFile(
    path.join(root, "src/edited file.ts"),
    "const edited = true;\n",
  );
  await writeFile(
    path.join(root, "src/unrelated.ts"),
    "const unrelated = true;\n",
  );
  await writeFile(
    path.join(root, "node_modules/eslint/bin/eslint.js"),
    'import {writeFileSync} from "node:fs"; writeFileSync("calls.json", JSON.stringify(process.argv.slice(2)));\n',
  );
  const posixRoot = hostPath(root);
  for (const [payload, expected] of [
    [
      { tool_input: { file_path: path.join(root, "src/edited.ts") } },
      path.join("src", "edited.ts"),
    ],
    [{ path: "src/edited.ts" }, path.join("src", "edited.ts")],
    [
      { tool_input: { file_path: `${posixRoot}/src/edited file.ts` } },
      path.join("src", "edited file.ts"),
    ],
  ]) {
    const result = runShell(payload, script);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, "calls.json"), "utf8")),
      ["--fix", "--", expected],
    );
  }
  assert.equal(
    await readFile(path.join(root, "src/unrelated.ts"), "utf8"),
    "const unrelated = true;\n",
  );
  await mkdir(path.join(root, "server/data"), { recursive: true });
  await writeFile(
    path.join(root, "server/data/private.ts"),
    "synthetic private state\n",
  );
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "src/alias"),
    "junction",
  );
  for (const payload of [
    { file_path: "../outside.ts" },
    { file_path: ".git/config.js" },
    "not-json",
    { file_path: "" },
    { file_path: "src/alias/private.ts" },
    { file_path: `${posixRoot}/../outside.ts` },
    { file_path: `${posixRoot}/src/alias/private.ts` },
    { tool_input: null, file_path: "src/edited.ts" },
  ]) {
    const rejected = runShell(payload, script);
    assert.equal(rejected.status, 2, rejected.stderr);
  }
  assert.equal(runShell({ file_path: "README.md" }, script).status, 0);
  assert.equal(runShell({}, script).status, 0);
});

test("post-edit helper propagates a missing or failed local lint tool", async (t) => {
  const { root, script } = await fixture(t, "post-edit-format.sh");
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src/edited.ts"), "const edited = true;\n");
  assert.equal(runShell({ file_path: "src/edited.ts" }, script).status, 2);
});
