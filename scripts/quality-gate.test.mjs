import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { bash, fixture, runtimeEnvironment } from "./hook.test-support.mjs";

const runQuality = (
  script,
  calls,
  changed,
  failure = "",
  repository = true,
  inherited = process.env,
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
    {
      env: runtimeEnvironment(inherited),
      encoding: "utf8",
      windowsHide: true,
    },
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

test("quality helper ignores inherited startup files while preserving its checks", async (t) => {
  const { root, script } = await fixture(t, "quality-gate.sh");
  const calls = path.join(root, "calls.log");
  const startup = path.join(root, "startup.sh");
  await writeFile(
    startup,
    "printf 'unexpected startup\\n' > \"${BASH_ENV}.ran\"\n",
  );
  const bashEnv =
    process.platform === "win32" ? startup.replaceAll("\\", "/") : startup;
  const previousBashEnv = process.env.BASH_ENV;
  process.env.BASH_ENV = bashEnv;
  let result;
  try {
    result = runQuality(script, calls, "src/edited.ts", "", true, {
      ...runtimeEnvironment(),
      BASH_ENV: bashEnv,
    });
  } finally {
    if (previousBashEnv === undefined) delete process.env.BASH_ENV;
    else process.env.BASH_ENV = previousBashEnv;
  }

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readFile(calls, "utf8")).trim().split(/\r?\n/), [
    "run lint",
    "run typecheck",
  ]);
  await assert.rejects(readFile(`${startup}.ran`), { code: "ENOENT" });
});
