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

test("guard recognizes dangerous Git subcommands after global options", () => {
  for (const prefix of [
    "git -C /synthetic/repository",
    'git -C "synthetic repository" -c advice.detachedHead=false',
    "git -c 'alias.example=log --oneline' --git-dir=synthetic.git",
    'git.exe --git-dir="synthetic repository/.git" --work-tree=synthetic',
    "git --no-pager -Csynthetic -cadvice.detachedHead=false",
  ]) {
    for (const subcommand of [
      "push --force origin feature",
      "push -f origin feature",
      "reset --hard HEAD~1",
      "clean -fd",
      "branch --delete stale",
      "branch -D stale",
      "push origin main",
    ]) {
      const command = `${prefix} ${subcommand}`;
      assert.equal(typeof inspectHookPayload({ command }), "string", command);
    }
    for (const subcommand of ["status", "push origin feature"])
      assert.equal(
        inspectHookPayload({ command: `${prefix} ${subcommand}` }),
        undefined,
      );
  }
});

test("guard blocks option-bearing environment dumps without blocking child commands", () => {
  for (const command of ["env -0", "env --null | sort", "env -i -0"])
    assert.match(
      inspectHookPayload({ command }),
      /Environment variable exposure/,
    );
  for (const command of [
    "env -i node --version",
    "env --null node --version",
    "myenv -0",
    "environment-check -0",
  ])
    assert.equal(inspectHookPayload({ command }), undefined, command);
});

test("guard blocks separate and long clean force flags before the path separator", () => {
  for (const command of [
    "git clean -d -f",
    "git clean --force",
    "git clean -x -ff",
    "git clean -df",
    "git clean -fX",
    "git clean -dfX",
    "git clean -Xf",
    "git clean --force -d",
    'git -C "synthetic repository" clean -d --force',
    "git clean -n -f",
    "git clean -f; echo done",
  ])
    assert.match(
      inspectHookPayload({ command }),
      /Dangerous git pattern/,
      command,
    );

  for (const command of [
    "git clean -n",
    "git clean --dry-run",
    "git clean --forceful",
    "git clean -- -file",
    "git clean -e -file",
    "git clean --exclude --force",
    "git clean -n; echo -f",
  ])
    assert.equal(inspectHookPayload({ command }), undefined, command);
});

test("guard matches complete protected push destinations rather than source or suffix names", () => {
  for (const destination of [
    "main",
    "master",
    "refs/heads/main",
    "refs/heads/master",
    "HEAD:main",
    "HEAD:refs/heads/main",
    "feature:master",
    "+HEAD:main",
  ])
    for (const prefix of ["git", 'git -C "synthetic repository"']) {
      const command = `${prefix} push origin ${destination}`;
      assert.match(
        inspectHookPayload({ command }),
        /Direct push to main\/master/,
        command,
      );
    }

  assert.match(
    inspectHookPayload({ command: "git push upstream main; echo done" }),
    /Direct push to main\/master/,
  );
  assert.match(
    inspectHookPayload({ command: "git push\torigin\tmain" }),
    /Direct push to main\/master/,
  );
  for (const remote of [
    '"origin"',
    "'upstream'",
    "--repo=origin",
    '--repo="upstream"',
    "--repo origin",
  ])
    assert.match(
      inspectHookPayload({ command: `git push ${remote} HEAD:main` }),
      /Direct push to main\/master/,
      remote,
    );
  for (const command of [
    "git push origin domain",
    "git push upstream remaster",
    "git push origin feature/main",
    "git push origin feature:topic/main",
    "git push origin main:feature",
    "git push origin refs/heads/main:refs/heads/feature",
    "git push origin main-fix",
    "git push origin feature; echo main",
    "git push origin feature\nmain",
    "git push origin feature\r\nmain",
  ])
    assert.equal(inspectHookPayload({ command }), undefined, command);
});

test("guard matches quoted protected refspecs as complete arguments", () => {
  for (const quote of ["'", '"']) {
    for (const refspec of [
      "main",
      "master",
      "refs/heads/main",
      "HEAD:main",
      "HEAD:refs/heads/master",
      "+HEAD:refs/heads/main",
      ":main",
    ]) {
      const command = `git push origin ${quote}${refspec}${quote}`;
      assert.match(
        inspectHookPayload({ command }),
        /Direct push to main\/master/,
        command,
      );
    }
    for (const refspec of [
      "domain",
      "feature/main",
      "main:feature",
      "HEAD:refs/heads/topic/main",
      "refs/tags/main",
    ]) {
      const command = `git push origin ${quote}${refspec}${quote}`;
      assert.equal(inspectHookPayload({ command }), undefined, command);
    }
  }
  for (const command of [
    `git push "origin" 'HEAD:main'`,
    `git -C "synthetic repository" push --repo=origin "main"`,
    `git push origin feature 'HEAD:main'; echo done`,
  ])
    assert.match(
      inspectHookPayload({ command }),
      /Direct push to main\/master/,
      command,
    );
  for (const command of [
    `git push origin feature --push-option="note main"`,
    `git push origin feature --push-option="note 'HEAD:main' extra"`,
    `git push origin '--push-option=HEAD:main' feature`,
    `git push origin feature; echo 'HEAD:main'`,
    `git push origin feature\necho "main"`,
  ])
    assert.equal(inspectHookPayload({ command }), undefined, command);
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
