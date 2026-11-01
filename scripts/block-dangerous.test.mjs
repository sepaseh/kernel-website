import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { inspectHookPayload } from "../.agents/hooks/block-dangerous.mjs";
import { aliasFixture, fixture, run } from "./hook.test-support.mjs";

test("portable safety guard blocks known dangerous commands and sensitive paths", () => {
  for (const payload of [
    { command: "git push --force origin feature" },
    { command: "git push --force-with-lease origin feature" },
    { command: "git.exe push --force-if-includes origin feature" },
    { command: "git push -f origin feature" },
    {
      command: "git push origin feature --force-with-lease=refs/heads/feature",
    },
    { command: "git clean\n-fd" },
    { command: "git reset --hard HEAD~1" },
    { command: "git clean -fd" },
    { command: "git branch -D stale" },
    { command: "git branch --delete stale" },
    { command: "git push origin main" },
    { file_path: ".env.local" },
    { path: "private/client.pem" },
    { command: "printenv" },
    { command: "Get-ChildItem Env:" },
    { command: "gci Env:" },
    { command: "export -p" },
    { command: "echo $TOKEN" },
    { command: "env | sort" },
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
    { command: "git push origin feature --forceful" },
    { command: "git reset --hardness" },
    { command: "git branch --delete-later" },
    { command: "environment-check" },
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

test("Node safety entrypoint inspects directory aliases with either main-module symlink mode", async (t) => {
  const { alias } = await aliasFixture(t);
  const linkedHook = path.join(alias, "block-dangerous.mjs");
  const paths = [linkedHook];
  if (process.platform === "win32")
    paths.push(
      path.join(
        path.dirname(linkedHook).toUpperCase(),
        path.basename(linkedHook),
      ),
    );
  for (const filename of paths)
    for (const flags of [[], ["--preserve-symlinks-main"]])
      for (const [payload, expected] of [
        [{ command: "git push --force origin feature" }, 2],
        [{ command: "npm run typecheck" }, 0],
      ]) {
        const result = spawnSync(process.execPath, [...flags, filename], {
          input: JSON.stringify(payload),
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(result.status, expected, result.stderr);
      }
});

test("main-module identity failures block instead of silently skipping inspection", async (t) => {
  const { root, script } = await fixture(t, "block-dangerous.mjs");
  const preload = path.join(root, "synthetic-preload.mjs");
  for (const setup of [
    `process.argv.length = 1;`,
    `process.argv[1] = ${JSON.stringify(path.join(root, "missing.mjs"))};`,
    `process.argv[1] = ${JSON.stringify(preload)};`,
  ]) {
    await writeFile(preload, setup);
    const result = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(preload).href, script],
      {
        input: JSON.stringify({ command: "npm run typecheck" }),
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /could not (?:verify|resolve) its entrypoint/);
  }
});

test("ordinary imports do not read stdin or resolve another entrypoint", async (t) => {
  const { root, script } = await fixture(t, "block-dangerous.mjs");
  for (const entrypoint of [undefined, path.join(root, "missing-main.mjs")]) {
    const source = [
      `import { readFileSync } from "node:fs";`,
      entrypoint === undefined
        ? `process.argv.length = 1;`
        : `process.argv[1] = ${JSON.stringify(entrypoint)};`,
      `await import(${JSON.stringify(pathToFileURL(script).href)});`,
      `process.stdout.write(readFileSync(0, "utf8"));`,
    ].join("\n");
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      {
        input: "intentionally not JSON",
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "intentionally not JSON");
  }
});
