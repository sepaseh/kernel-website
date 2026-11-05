import assert from "node:assert/strict";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  aliasFixture,
  run,
  runShell,
  shellHook,
} from "./hook.test-support.mjs";

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

test("native Node paths preserve safety-wrapper behavior and empty input fails closed", () => {
  assert.equal(
    runShell({ command: "npm run typecheck" }, shellHook, false, true).status,
    0,
  );
  assert.equal(runShell("", shellHook, false, true).status, 2);
});

test("Bash safety wrapper fails closed when Node is unavailable", () => {
  const result = runShell({ command: "npm run typecheck" }, shellHook, true);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /requires Node\.js/);
});

test("Bash safety wrapper resolves a directory alias to the Node guard", async (t) => {
  const { script, alias } = await aliasFixture(t);
  await copyFile(
    shellHook,
    path.join(path.dirname(script), "block-dangerous.sh"),
  );
  for (const [payload, expected] of [
    [{ command: "git push --force origin feature" }, 2],
    [{ command: "npm run typecheck" }, 0],
  ]) {
    const result = runShell(payload, path.join(alias, "block-dangerous.sh"));
    assert.equal(result.status, expected, result.stderr);
  }
});
