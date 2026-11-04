import assert from "node:assert/strict";
import { readdir } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { globFiles } from "@sentry/bundler-plugins/core";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";

const fixture = async (t) => {
  const parent = await realpath(os.tmpdir());
  const directory = await mkdtemp(path.join(parent, "website-dependencies-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith("website-dependencies-"));
    assert.equal(await realpath(directory), directory);
    await rm(directory, { force: true, recursive: true });
  });
  const put = async (name, value) => {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value);
  };
  return { directory, put };
};

test("patched lint dependencies preserve TypeScript project globs and ignore rules", async (t) => {
  const { directory, put } = await fixture(t);
  await put(
    "configs/tsconfig.fixture.json",
    JSON.stringify({
      compilerOptions: { target: "ES2022", jsx: "preserve" },
      include: ["../src/**/*.ts", "../src/**/*.tsx"],
    }),
  );
  await put("src/valid.ts", "export const answer: number = 42;\n");
  await put("src/deep/invalid.ts", "const unused: number = 42;\n");
  await put("src/project.ts", "Promise.resolve(42);\n");
  await put("src/view.tsx", "const unusedView = <main />;\n");
  await put("src/ignored/invalid.ts", "not valid TypeScript\n");
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: ["**/ignored/**"] },
      ...tseslint.configs.recommended,
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
          parserOptions: {
            project: ["configs/tsconfig.*.json"],
            tsconfigRootDir: directory,
          },
        },
        rules: { "@typescript-eslint/no-floating-promises": "error" },
      },
    ],
  });

  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

  assert.deepEqual(
    results
      .map((result) =>
        path.relative(directory, result.filePath).replaceAll("\\", "/"),
      )
      .sort(),
    ["src/deep/invalid.ts", "src/project.ts", "src/valid.ts", "src/view.tsx"],
  );
  assert.deepEqual(
    results.flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    ),
    [
      "@typescript-eslint/no-unused-vars",
      "@typescript-eslint/no-floating-promises",
      "@typescript-eslint/no-unused-vars",
    ],
  );
  assert.equal(
    results.reduce((total, result) => total + result.fatalErrorCount, 0),
    0,
  );
});

test("the glob regression uses the installed Lighthouse Sentry consumer", async () => {
  let manifest = findPackageJSON("lighthouse", import.meta.url);
  assert.ok(manifest);
  for (const dependency of ["@sentry/node", "@sentry/bundler-plugins"]) {
    const owner = JSON.parse(await readFile(manifest, "utf8"));
    assert.ok(Object.hasOwn(owner.dependencies, dependency));
    manifest = findPackageJSON(dependency, manifest);
    assert.ok(manifest);
    assert.equal(JSON.parse(await readFile(manifest, "utf8")).name, dependency);
  }
  const imported = findPackageJSON(
    "@sentry/bundler-plugins/core",
    import.meta.url,
  );
  assert.ok(imported);
  assert.equal(await realpath(imported), await realpath(manifest));
});

test("patched glob preserves the installed Lighthouse Sentry consumer's file selection", async (t) => {
  const { directory, put } = await fixture(t);
  await put("assets/app.js", "export {};\n");
  await put("assets/deep/app.js.map", "{}\n");
  await put("assets/deep/ignored.js", "export {};\n");
  await put("assets/readme.txt", "fixture\n");
  const files = await globFiles(["assets/**/*.{js,map}"], {
    cwd: directory,
    ignore: ["**/ignored.js"],
  });

  assert.deepEqual(
    files.sort(),
    ["assets/app.js", "assets/deep/app.js.map"]
      .map((name) => path.join(directory, name))
      .sort(),
  );
});

test("patched glob stops directory traversal when its consumer aborts", async (t) => {
  const { directory, put } = await fixture(t);
  await put("assets/deep/app.js", "export {};\n");
  const controller = new AbortController();
  const failure = new Error("Owned traversal cancelled");
  const readCompleted = Promise.withResolvers();
  let reads = 0;

  await assert.rejects(
    globFiles(["**/*.js"], {
      cwd: directory,
      signal: controller.signal,
      fs: {
        readdir(target, options, callback) {
          reads += 1;
          readdir(target, options, (error, entries) => {
            try {
              controller.abort(failure);
              callback(error, entries);
            } finally {
              readCompleted.resolve();
            }
          });
        },
      },
    }),
    (error) => error === failure,
  );
  await readCompleted.promise;

  assert.equal(reads, 1);
});
