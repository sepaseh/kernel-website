import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  inspectBoundaries,
  validateModuleImports,
  validateStandalonePackage,
} from "./check-boundaries.mjs";

const pkg = {
  name: "kernel-website",
  type: "module",
  dependencies: { yaml: "1.0.0" },
  devDependencies: { vitest: "1.0.0", typescript: "1.0.0" },
};
const lock = () => ({
  name: pkg.name,
  packages: { "": { ...pkg }, "node_modules/yaml": { version: "1.0.0" } },
});

test("package guard checks root identities and exact dependency metadata without workspaces or local links", () => {
  validateStandalonePackage(pkg, lock());
  for (const change of [
    { name: "other" },
    { type: "commonjs" },
    { workspaces: [] },
    { dependencies: { yaml: "file:../private" } },
    { dependencies: { "@kernel/api": "1.0.0" } },
  ]) {
    const changed = { ...pkg, ...change };
    const changedLock = lock();
    changedLock.name = changed.name;
    changedLock.packages[""] = changed;
    assert.throws(() => validateStandalonePackage(changed, changedLock));
  }
  for (const change of [
    (value) => {
      value.name = "other";
    },
    (value) => {
      value.packages[""].name = "other";
    },
    (value) => {
      value.packages[""] = { ...pkg, dependencies: {} };
    },
    (value) => {
      value.packages["node_modules/yaml"].link = true;
    },
    (value) => {
      value.packages["packages/unowned"] = {};
    },
  ]) {
    const value = lock();
    change(value);
    assert.throws(() => validateStandalonePackage(pkg, value));
  }
});

test("imports retain owner-specific package permission, literal Node imports and reviewed local edges", () => {
  validateModuleImports(
    "scripts/check-ci.mjs",
    "import {parseDocument} from 'yaml'; export {publicationFiles} from './validate-bootstrap.mjs'; await import('node:fs');",
    pkg,
  );
  validateModuleImports(
    "scripts/owner.test.mjs",
    "import {test} from 'node:test'; import {expect} from 'vitest';",
    pkg,
  );
  validateModuleImports(
    "scripts/owner.test.mjs",
    "const source = require('./validate-bootstrap.mjs');",
    pkg,
  );
  for (const source of [
    "import 'node:not-a-builtin';",
    "import '../.env.local';",
    "import 'https://unowned.test/code.mjs';",
    "import '/private/source.mjs';",
    "import 'missing-package';",
    "import 'yaml';",
    "await import(process.argv[2]);",
    "require('./validate-bootstrap.mjs', 'extra');",
    "export const = ;",
  ])
    assert.throws(() =>
      validateModuleImports("scripts/validate.mjs", source, pkg),
    );
});

test("createRequire imports cannot bypass literal package ownership through aliases", () => {
  for (const builtin of ["module", "node:module"]) {
    for (const imported of ["createRequire", "createRequire as load"]) {
      const source = `import {${imported}} from '${builtin}';`;
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", source, pkg),
        /createRequire bypasses/,
      );
    }
  }

  validateModuleImports(
    "scripts/validate.mjs",
    "import {isBuiltin as createRequire} from 'node:module'; const other = {createRequire() {}};",
    pkg,
  );
  validateModuleImports("scripts/validate.mjs", "import 'node:module';", pkg);
  validateModuleImports(
    "scripts/validate.mjs",
    "import * as modules from 'node:module';",
    pkg,
  );
});

test("module bindings and simple aliases cannot expose createRequire", () => {
  for (const builtin of ["module", "node:module"]) {
    for (const binding of [
      `import * as modules from '${builtin}';`,
      `import modules from '${builtin}';`,
      `import {default as modules} from '${builtin}';`,
      `const modules = await import('${builtin}');`,
      `const modules = require('${builtin}');`,
      `let modules; modules = await import('${builtin}');`,
      `let modules; modules = require('${builtin}');`,
    ]) {
      for (const access of [
        "modules.createRequire(import.meta.url)('yaml');",
        "modules['createRequire'](import.meta.url);",
        "modules[`createRequire`];",
        "modules?.createRequire;",
        "const {createRequire} = modules;",
        "const {createRequire: load} = modules;",
        "const {['createRequire']: load} = modules;",
        "let load; ({createRequire: load} = modules);",
        "const alias = (modules); const another = alias; another.createRequire;",
        "let alias; alias = modules; let another; another = alias; another.createRequire;",
        "let alias; let another; alias = another; another = modules; alias.createRequire;",
      ])
        assert.throws(
          () =>
            validateModuleImports(
              "scripts/validate.mjs",
              binding + access,
              pkg,
            ),
          /createRequire bypasses/,
          binding + access,
        );
    }
    for (const expression of [
      `(await import('${builtin}')).createRequire;`,
      `require('${builtin}')['createRequire'];`,
      `const {createRequire} = await import('${builtin}');`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", expression, pkg),
        /createRequire bypasses/,
      );
  }
});

test("module-origin checks preserve other members and unrelated or shadowing bindings", () => {
  for (const source of [
    "import * as modules from 'node:module'; modules.isBuiltin('fs');",
    "import modules from 'node:module'; modules.isBuiltin('fs');",
    "const modules = await import('node:module'); const {isBuiltin} = modules;",
    "const modules = require('node:module'); const alias = modules; alias.isBuiltin('fs');",
    "const other = {createRequire() {}}; other.createRequire;",
    "const other = {createRequire() {}}; const {createRequire: load} = other;",
    "const other = {createRequire() {}}; let load; ({createRequire: load} = other);",
    "import * as modules from 'node:module'; function inspect(modules) { modules.createRequire; }",
    "import * as modules from 'node:module'; {const modules = {createRequire() {}}; modules.createRequire;}",
    "import * as modules from 'node:module'; const alias = modules; function inspect(alias) { alias['createRequire']; }",
    "function inspect(require) { const modules = require('node:module'); modules.createRequire; }",
    "let other; other = {createRequire() {}}; let alias; alias = other; alias.createRequire;",
    "let modules; modules = await import('node:module'); function inspect(modules) { modules = {createRequire() {}}; modules.createRequire; }",
    "let modules; modules = require('node:module'); {let modules; modules = {createRequire() {}}; modules.createRequire;}",
    "import * as modules from 'node:module'; let alias; alias = modules; function inspect(alias) { alias = {}; alias['createRequire']; }",
    "let left; let right; left = right; right = left; left.createRequire;",
    "const left = right; const right = left; left.createRequire;",
    "unknown.createRequire;",
    "import * as modules from 'node:module'; modules[0]; modules[member];",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("the actual published tree has no backend source, workspaces or import escapes", async () => {
  await inspectBoundaries();
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    current.allowedFiles.some((file) => file.startsWith("src/")),
    false,
  );
});

test("the reviewed import-sort plugin is permitted only for its ESLint owner", () => {
  const declared = {
    ...pkg,
    devDependencies: {
      ...pkg.devDependencies,
      "eslint-plugin-simple-import-sort": "1.0.0",
    },
  };
  const source = "import sort from 'eslint-plugin-simple-import-sort';";
  validateModuleImports("eslint.config.mjs", source, declared);
  assert.throws(
    () => validateModuleImports("scripts/validate.mjs", source, declared),
    /not permitted for this owner/,
  );
  assert.throws(
    () => validateModuleImports("eslint.config.mjs", source, pkg),
    /Undeclared dependency/,
  );
});

test("the Markdown parser is permitted only for its guidance owner", () => {
  const declared = {
    ...pkg,
    devDependencies: { ...pkg.devDependencies, prettier: "1.0.0" },
  };
  const source = "import {parsers} from 'prettier/plugins/markdown';";
  validateModuleImports("scripts/check-guidance.mjs", source, declared);
  assert.throws(
    () => validateModuleImports("scripts/validate.mjs", source, declared),
    /not permitted for this owner/,
  );
  assert.throws(
    () => validateModuleImports("scripts/check-guidance.mjs", source, pkg),
    /Undeclared dependency/,
  );
});
