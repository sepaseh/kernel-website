import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { inspectHookPayload } from "../.agents/hooks/block-dangerous.mjs";

const hooks = fileURLToPath(new URL("../.agents/hooks/", import.meta.url));
const hook = path.join(hooks, "block-dangerous.mjs");
const shellHook = path.join(hooks, "block-dangerous.sh");
const run = (payload) =>
  spawnSync(process.execPath, [hook], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  });
const bash = [
  ...(process.platform === "win32"
    ? ["C:/Program Files/Git/bin/bash.exe"]
    : ["/bin/bash", "/usr/bin/bash"]),
  "bash",
].find(
  (candidate) =>
    spawnSync(candidate, ["--noprofile", "--norc", "-c", "exit 0"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    }).status === 0,
);
const runShell = (payload, script = shellHook, missingNode = false) => {
  assert.ok(
    bash,
    "Portable hook checks require usable Bash, including on Windows.",
  );
  return spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      `hook_path=$1
node_path=$2
if command -v cygpath >/dev/null 2>&1; then
  hook_path=$(cygpath -u "$hook_path") || exit 2
  node_path=$(cygpath -u "$node_path") || exit 2
elif command -v wslpath >/dev/null 2>&1; then
  hook_path=$(wslpath -u "$hook_path") || exit 2
  node_path=$(wslpath -u "$node_path") || exit 2
fi
if [ "$3" = missing-node ]; then
  PATH='' exec "$BASH" "$hook_path"
else
  PATH="$(dirname "$node_path"):$PATH" exec "$BASH" "$hook_path"
fi`,
      "optional-hook-test",
      script,
      process.execPath,
      missingNode ? "missing-node" : "node-available",
    ],
    {
      input: typeof payload === "string" ? payload : JSON.stringify(payload),
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    },
  );
};

test("portable safety guard blocks known dangerous commands and sensitive paths", () => {
  for (const payload of [
    { command: "git push --force origin feature" },
    { command: "git push --force-with-lease origin feature" },
    { command: "git.exe push --force-if-includes origin feature" },
    { command: "git push -f origin feature" },
    { command: "git reset --hard HEAD~1" },
    { command: "git clean -fd" },
    { command: "git branch -D stale" },
    { command: "git branch --delete stale" },
    { command: "git push origin main" },
    { file_path: ".env.local" },
    { path: "private/client.pem" },
    { command: "printenv" },
    { command: "Get-ChildItem Env:" },
    { command: "curl https://production.example.com" },
    { cmd: "Invoke-RestMethod https://api.mainnet.example.com" },
  ])
    assert.equal(
      typeof inspectHookPayload(payload),
      "string",
      JSON.stringify(payload),
    );
});

test("guard accepts ordinary documentation, public examples and safe checks", () => {
  for (const payload of [
    { command: "npm run typecheck" },
    { tool_input: { command: "npm run lint" } },
    {
      file_path: "docs/deployment.md",
      content: "Production deployment is future work.",
    },
    { file_path: ".env.example", content: "PUBLIC_EXAMPLE=synthetic" },
    { path: "src/feature.ts" },
    {},
  ])
    assert.equal(inspectHookPayload(payload), undefined);
  for (const payload of [
    "not-json",
    "null",
    "[]",
    { tool_input: null },
    { command: 4 },
    { path: [] },
  ])
    assert.equal(typeof inspectHookPayload(payload), "string");
});

test("Node safety entrypoint preserves inspected exit status", () => {
  assert.equal(run({ command: "npm run typecheck" }).status, 0);
  assert.equal(run({ command: "git push --force origin feature" }).status, 2);
  assert.equal(run("not-json").status, 2);
});

test("Bash safety wrapper preserves raw input and guard status without jq", () => {
  for (const payload of [
    "not-json",
    { command: "git push --force-with-lease origin feature" },
    { tool_input: { command: "git push --force-with-lease origin feature" } },
    { command: "npm run typecheck" },
  ]) {
    const result = runShell(payload);
    assert.equal(result.status, run(payload).status, result.stderr);
  }
});

test("Bash wrappers fail closed when Node is unavailable", () => {
  for (const script of [shellHook, path.join(hooks, "post-edit-format.sh")]) {
    const result = runShell({ command: "npm run typecheck" }, script, true);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /requires Node\.js/);
  }
});

const fixture = async (t, hookName) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "website-optional-hook-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, ".agents/hooks", hookName);
  await mkdir(path.dirname(script), { recursive: true });
  await copyFile(path.join(hooks, hookName), script);
  return { root, script };
};

test("post-edit helper passes only the selected in-project file to installed ESLint", async (t) => {
  const { root, script } = await fixture(t, "post-edit-format.sh");
  await mkdir(path.join(root, "node_modules/eslint/bin"), { recursive: true });
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(path.join(root, "src/edited.ts"), "const edited = true;\n");
  await writeFile(
    path.join(root, "src/unrelated.ts"),
    "const unrelated = true;\n",
  );
  await writeFile(
    path.join(root, "node_modules/eslint/bin/eslint.js"),
    'import {writeFileSync} from "node:fs"; writeFileSync("calls.json", JSON.stringify(process.argv.slice(2)));\n',
  );
  const result = runShell(
    { tool_input: { file_path: path.join(root, "src/edited.ts") } },
    script,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, "calls.json"), "utf8")),
    ["--fix", "--", path.join("src", "edited.ts")],
  );
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

const runQuality = (
  script,
  calls,
  changed,
  failure = "",
  repository = true,
) => {
  assert.ok(bash, "Portable hook checks require usable Bash.");
  return spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      `
hook_path=$1
test_calls=$2
test_changed=$3
test_failure=$4
test_repository=$5
if command -v cygpath >/dev/null 2>&1; then
  hook_path=$(cygpath -u "$hook_path") || exit 2
  test_calls=$(cygpath -u "$test_calls") || exit 2
elif command -v wslpath >/dev/null 2>&1; then
  hook_path=$(wslpath -u "$hook_path") || exit 2
  test_calls=$(wslpath -u "$test_calls") || exit 2
fi
git() {
  case "$1" in
    rev-parse) [ "$test_repository" = yes ] ;;
    diff) printf '%s\\n' "$test_changed" ;;
    ls-files) return 0 ;;
    *) return 1 ;;
  esac
}
npm() {
  printf '%s\\n' "$*" >> "$test_calls"
  [ "$2" != "$test_failure" ]
}
export test_calls test_changed test_failure test_repository
export -f git npm
exec "$BASH" "$hook_path"
`,
      "quality-hook-test",
      script,
      calls,
      changed,
      failure,
      repository ? "yes" : "no",
    ],
    { encoding: "utf8", timeout: 10_000, windowsHide: true },
  );
};

test("quality helper runs lint/types for changed TS and stops on failures", async (t) => {
  const { root, script } = await fixture(t, "quality-gate.sh");
  const calls = path.join(root, "calls.log");
  const passing = runQuality(script, calls, "src/edited.ts");
  assert.equal(passing.status, 0, passing.stderr);
  assert.deepEqual((await readFile(calls, "utf8")).trim().split(/\r?\n/), [
    "run lint",
    "run typecheck",
  ]);
  await writeFile(calls, "");
  assert.equal(runQuality(script, calls, "src/edited.tsx", "lint").status, 2);
  assert.equal((await readFile(calls, "utf8")).trim(), "run lint");
  await writeFile(calls, "");
  assert.equal(runQuality(script, calls, "README.md").status, 0);
  assert.equal(await readFile(calls, "utf8"), "");
  assert.equal(
    runQuality(script, calls, "src/edited.ts", "typecheck").status,
    2,
  );
  assert.equal(runQuality(script, calls, "", "", false).status, 2);
});
