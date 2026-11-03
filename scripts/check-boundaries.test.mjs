import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import ts from "typescript";

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
      `import {Module as modules} from '${builtin}';`,
      `const modules = await import('${builtin}');`,
      `const modules = (await import('${builtin}')).default;`,
      `const modules = (await import('${builtin}'))['default'];`,
      `import * as namespace from '${builtin}'; const modules = namespace.Module;`,
      `import base from '${builtin}'; const modules = base['Module'];`,
      `const modules = require('${builtin}');`,
      `const modules = require('${builtin}').Module;`,
      `const {default: modules} = await import('${builtin}');`,
      `const {['Module']: modules} = require('${builtin}');`,
      `let modules; ({default: modules} = await import('${builtin}'));`,
      `let modules; ({Module: modules} = require('${builtin}'));`,
      `const modules = process.getBuiltinModule('${builtin}');`,
      `const modules = process['getBuiltinModule']('${builtin}');`,
      `let modules; modules = await import('${builtin}');`,
      `let modules; modules = require('${builtin}');`,
    ]) {
      for (const access of [
        "modules.createRequire(import.meta.url)('yaml');",
        "modules['createRequire'](import.meta.url);",
        "modules[`createRequire`];",
        "modules?.createRequire;",
        "modules['create' + 'Require'](import.meta.url)('yaml');",
        "const key = 'createRequire'; modules[key](import.meta.url)('yaml');",
        "modules[0];",
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
      `require('${builtin}').Module.createRequire;`,
      `(await import('${builtin}')).default.createRequire;`,
      `import {Module} from '${builtin}'; Module.createRequire;`,
      `process.getBuiltinModule('${builtin}').createRequire;`,
      `const {createRequire} = await import('${builtin}');`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", expression, pkg),
        /createRequire bypasses/,
      );
  }
});

test("module loader origins follow process imports, aliased callees, reassignments and rest bindings", () => {
  for (const builtin of ["module", "node:module"]) {
    for (const binding of [
      `const load = require; const modules = load('${builtin}');`,
      `let load; load = require; const modules = load('${builtin}');`,
      `const load = process.getBuiltinModule; const modules = load('${builtin}');`,
      `let load; load = process['getBuiltinModule']; const alias = load; const modules = alias('${builtin}');`,
      `const {getBuiltinModule: load} = process; const modules = load('${builtin}');`,
      `let load; ({getBuiltinModule: load} = process); const modules = load('${builtin}');`,
      `let getBuiltinModule; ({getBuiltinModule} = process); const modules = getBuiltinModule('${builtin}');`,
      `import process from 'node:process'; const modules = process.getBuiltinModule('${builtin}');`,
      `import * as process from 'node:process'; const modules = process.getBuiltinModule('${builtin}');`,
      `import {default as runtime} from 'node:process'; const process = runtime; const modules = process.getBuiltinModule('${builtin}');`,
      `import {getBuiltinModule as load} from 'node:process'; const modules = load('${builtin}');`,
      `let runtime; runtime = process; const load = runtime.getBuiltinModule; const modules = load('${builtin}');`,
      `const runtime = await import('node:process'); const modules = runtime.default.getBuiltinModule('${builtin}');`,
      `const runtime = require('node:process'); const modules = runtime.getBuiltinModule('${builtin}');`,
      `const {...modules} = await import('${builtin}');`,
      `const {isBuiltin, ...modules} = require('${builtin}');`,
      `let modules; ({...modules} = await import('${builtin}'));`,
      `let Module; ({Module} = await import('${builtin}')); const modules = Module;`,
    ])
      assert.throws(
        () =>
          validateModuleImports(
            "scripts/validate.mjs",
            binding + "modules.createRequire(import.meta.url)('yaml');",
            pkg,
          ),
        /createRequire bypasses/,
        binding,
      );
  }
});

test("module-origin loaders and namespaces cannot escape through exports", () => {
  for (const builtin of ["module", "node:module"]) {
    for (const source of [
      `export default {modules: await import('${builtin}')};`,
      `export default {nested: {modules: await import('${builtin}')}};`,
      `const modules = await import('${builtin}'); export default {modules};`,
      `const modules = await import('${builtin}'); export default {nested: {modules}};`,
      `export default {...await import('${builtin}')};`,
      `export * from '${builtin}';`,
      `export * as modules from '${builtin}';`,
      `export {createRequire} from '${builtin}';`,
      `export {createRequire as load} from '${builtin}';`,
      `export {Module} from '${builtin}';`,
      `export {Module as modules} from '${builtin}';`,
      `export {default} from '${builtin}';`,
      `export {default as modules} from '${builtin}';`,
      `import * as modules from '${builtin}'; export {modules};`,
      `import modules from '${builtin}'; export {modules as exported};`,
      `import {Module as modules} from '${builtin}'; export default modules;`,
      `const modules = await import('${builtin}'); const alias = modules; export {alias};`,
      `let modules; modules = process.getBuiltinModule('${builtin}'); export {modules as default};`,
      `export const modules = await import('${builtin}');`,
      `export let modules; modules = require('${builtin}');`,
      `const modules = await import('${builtin}'); export const {Module: alias} = modules;`,
      `const modules = await import('${builtin}'); export const {default: alias} = modules;`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", source, pkg),
        /createRequire bypasses/,
        source,
      );
  }
});

test("module destructuring checks computed keys and nested member paths", () => {
  for (const source of [
    "const modules = await import('node:module'); const key = 'createRequire'; const {[key]: load} = modules;",
    "const modules = await import('node:module'); const key = 'createRequire'; let load; ({[key]: load} = modules);",
    "const modules = await import('node:module'); const {['create' + 'Require']: load} = modules;",
    "const {default: {createRequire: load}} = await import('node:module');",
    "const {Module: {default: {createRequire: load}}} = await import('node:module');",
    "const {default: {[key]: load}} = await import('node:module');",
    "let load; ({default: {createRequire: load}} = await import('node:module'));",
    "let load; ({default: {createRequire: load} = {}} = await import('node:module'));",
    "const {default: {createRequire: load} = {}} = await import('node:module');",
    "let load; ({Module: {default: {createRequire: load}}} = await import('node:module'));",
    "let load; ({default: {[key]: load}} = await import('node:module'));",
    "const {default: {Module: modules}} = await import('node:module'); modules.createRequire;",
    "const {default: {...modules}} = await import('node:module'); modules.createRequire;",
    "let modules; ({default: {Module: modules}} = await import('node:module')); modules.createRequire;",
    "let modules; ({default: {Module: modules = {}} = {}} = await import('node:module')); modules.createRequire;",
    "let modules; ({default: {...modules}} = await import('node:module')); modules.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );

  for (const source of [
    "const other = {createRequire() {}}; const {[key]: load} = other;",
    "const other = {createRequire() {}}; let load; ({[key]: load} = other);",
    "const other = {default: {createRequire() {}}}; const {default: {createRequire: load}} = other;",
    "const other = {default: {createRequire() {}}}; let load; ({default: {createRequire: load}} = other);",
    "const other = {default: {createRequire() {}}}; let load; ({default: {createRequire: load} = {}} = other);",
    "const {default: {isBuiltin}} = await import('node:module'); export {isBuiltin};",
    "let isBuiltin; ({default: {isBuiltin}} = await import('node:module')); export {isBuiltin};",
    "const {default: {isBuiltin: {createRequire}}} = await import('node:module');",
    "const {default: {isBuiltin: {[key]: value}}} = await import('node:module');",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("global process loaders and aliased loaders retain literal specifier checks", () => {
  for (const receiver of [
    "globalThis.process",
    "globalThis['process']",
    "globalThis[`process`]",
  ])
    assert.throws(
      () =>
        validateModuleImports(
          "scripts/validate.mjs",
          `${receiver}.getBuiltinModule('node:module').createRequire;`,
          pkg,
        ),
      /createRequire bypasses/,
    );
  for (const source of [
    "const root = globalThis; root.process.getBuiltinModule('node:module').createRequire;",
    "let root; root = globalThis; root['process']['getBuiltinModule']('node:module').createRequire;",
    "const {process: {getBuiltinModule: load}} = globalThis; load('node:module').createRequire;",
    "let load; ({process: {getBuiltinModule: load}} = globalThis); load('node:module').createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "process.getBuiltinModule('mod' + 'ule').createRequire;",
    "globalThis.process.getBuiltinModule('node:' + 'module').createRequire;",
    "const load = require; load('node:' + 'module').createRequire;",
    "let load; load = require; load(specifier);",
    "const load = process.getBuiltinModule; load('mod' + 'ule').createRequire;",
    "import {getBuiltinModule as load} from 'node:process'; load(specifier);",
    "import process from 'node:process'; process.getBuiltinModule(specifier);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /Computed imports are forbidden/,
      source,
    );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "const load = require; load('yaml');",
        pkg,
      ),
    /not permitted for this owner/,
  );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "const load = process.getBuiltinModule; load();",
        pkg,
      ),
    /Imports need one literal argument/,
  );

  validateModuleImports(
    "scripts/check-ci.mjs",
    "const load = require; load('yaml');",
    pkg,
  );
  for (const source of [
    "process.getBuiltinModule('fs'); globalThis.process.getBuiltinModule('node:fs');",
    "const load = require; load('./validate-bootstrap.mjs');",
    "const {getBuiltinModule: load} = process; load('node:fs');",
    "function inspect(globalThis) { globalThis.process.getBuiltinModule(specifier).createRequire; }",
    "const globalThis = {process: {getBuiltinModule() {}}}; globalThis.process.getBuiltinModule(specifier).createRequire;",
    "const other = {process: {getBuiltinModule() {}}}; other.process.getBuiltinModule(specifier).createRequire;",
    "function inspect(require) { const load = require; load(specifier); }",
    "function inspect(process) { const load = process.getBuiltinModule; load(specifier); }",
    "const process = {getBuiltinModule() {}}; process.getBuiltinModule(specifier);",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("export checks follow bound object and array containers without executing functions", () => {
  const binding = "const modules = await import('node:module');";
  for (const source of [
    "const bag = {modules}; export default bag;",
    "const bag = {modules}; const alias = bag; export {alias};",
    "let bag; bag = {nested: {modules}}; export default bag;",
    "export default [modules];",
    "const bag = [modules]; export default bag;",
    "const bag = [{nested: modules}]; export const alias = bag;",
    "let bag; bag = [modules]; const alias = bag; export {alias};",
    "const bag = [modules]; export default [...bag];",
    "const bag = {modules}; export default {nested: bag};",
    "let left; let right; left = right; right = {left, modules}; export default left;",
    "const bag = {modules}; export default {...bag};",
    "export let bag; bag = {modules};",
  ])
    assert.throws(
      () =>
        validateModuleImports("scripts/validate.mjs", binding + source, pkg),
      /createRequire bypasses/,
      source,
    );

  for (const source of [
    "const {isBuiltin} = await import('node:module'); const bag = {isBuiltin}; export default bag;",
    "const {isBuiltin} = await import('node:module'); const bag = [isBuiltin]; export {bag};",
    "let left; let right; left = right; right = {left}; export default left;",
    "const bag = [bag]; export default bag;",
    "const bag = {createRequire() {}}; export default bag;",
    "const bag = {get modules() { return {}; }}; export default bag;",
    "const bag = [, , {value: 1}]; export default bag;",
    "function build() { return {}; } export default build();",
    "let bag; export default bag;",
    "const modules = await import('node:module'); function inspect(modules) { const bag = {modules}; return bag; } export default inspect;",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("logical assignments retain module and loader origins", () => {
  for (const operator of ["??=", "||=", "&&="]) {
    const initial = operator === "&&=" ? "{}" : "undefined";
    const source = `let modules = ${initial}; modules ${operator} await import('node:module'); modules.createRequire(import.meta.url)('yaml');`;
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
    assert.throws(
      () =>
        validateModuleImports(
          "scripts/validate.mjs",
          `let load = ${initial}; load ${operator} require; load('yaml');`,
          pkg,
        ),
      /not permitted for this owner/,
    );
    validateModuleImports(
      "scripts/validate.mjs",
      `let modules = ${initial}; modules ${operator} {createRequire() {}}; modules.createRequire;`,
      pkg,
    );
  }
});

test("conditional writes, retained aliases and closures preserve possible loader origins", () => {
  for (const source of [
    "let load = process.getBuiltinModule; if (condition) load = value => value; load(process.argv[2]);",
    "let load = value => value; const invoke = () => load(process.argv[2]); load = process.getBuiltinModule; invoke();",
    "let load = process.getBuiltinModule; const retained = load; load = value => value; retained(process.argv[2]);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /Computed imports are forbidden/,
      source,
    );
  for (const source of [
    "const load = process.getBuiltinModule; load('node:fs'); const passthrough = value => value; passthrough(process.argv[2]);",
    "const load = process.getBuiltinModule; { const load = value => value; load(process.argv[2]); } load('node:fs');",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("array bindings and assignments retain module selections, rest and defaults", () => {
  for (const binding of [
    "const [modules] = [await import('node:module')];",
    "let modules; [modules] = [await import('node:module')];",
    "const [, modules] = [0, await import('node:module')];",
    "const [[modules]] = [[await import('node:module')]];",
    "const [modules = {}] = [await import('node:module')];",
    "let modules; [modules = {}] = [await import('node:module')];",
    "const [modules = await import('node:module')] = [];",
    "let modules; [modules = await import('node:module')] = [];",
    "const [...rest] = [await import('node:module')]; const modules = rest[0];",
    "let rest; [...rest] = [await import('node:module')]; const modules = rest[0];",
    "const [, ...rest] = [0, await import('node:module')]; const modules = rest[0];",
    "const [{default: modules}] = [await import('node:module')];",
    "const [,, modules] = [...[0, 0], await import('node:module')];",
    "const prefix = [0, 0]; const [,, modules] = [...prefix, await import('node:module')];",
    "const prefix = [0, 0]; let modules; [,, modules] = [...prefix, await import('node:module')];",
  ])
    assert.throws(
      () =>
        validateModuleImports(
          "scripts/validate.mjs",
          binding + "modules.createRequire;",
          pkg,
        ),
      /createRequire bypasses/,
      binding,
    );
  for (const source of [
    "const [{createRequire: load}] = [await import('node:module')];",
    "let load; [{createRequire: load}] = [await import('node:module')];",
    "const [{createRequire: load} = await import('node:module')] = [];",
    "let load; [{createRequire: load} = await import('node:module')] = [];",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const [modules] = [{createRequire() {}}]; modules.createRequire;",
    "let modules; [modules = {}] = [{createRequire() {}}]; modules.createRequire;",
    "const [{createRequire: load} = {createRequire() {}}] = [];",
    "let load; [{createRequire: load} = {createRequire() {}}] = [];",
    "const [...rest] = [{createRequire() {}}]; rest[0].createRequire;",
    "const [safe] = [1, await import('node:module')]; export {safe};",
    "const [, safe] = [...[0, 0], await import('node:module')]; export {safe};",
    "const prefix = [0, 0]; const [, safe] = [...prefix, await import('node:module')]; export default safe;",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("local object properties retain only the selected module receiver", () => {
  for (const source of [
    "const bag = {modules: await import('node:module')}; bag.modules.createRequire;",
    "const modules = await import('node:module'); const bag = {modules}; bag['modules'].createRequire;",
    "const bag = {nested: {modules: await import('node:module')}}; const alias = bag; alias.nested.modules.createRequire;",
    "let bag; bag = {modules: await import('node:module')}; bag.modules.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const bag = {modules: await import('node:module'), safe: {createRequire() {}}}; bag.safe.createRequire;",
    "const bag = {modules: {createRequire() {}}}; bag.modules.createRequire;",
    "const bag = {modules: await import('node:module')}; function inspect(bag) { bag.modules.createRequire; }",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("exported functions cannot return module namespaces or module-bearing containers", () => {
  for (const source of [
    "export const getModules = () => import('node:module');",
    "export default async () => await import('node:module');",
    "export function getModules() { return import('node:module'); }",
    "export default function () { return import('node:module'); }",
    "function getModules() { const modules = import('node:module'); return {modules}; } export {getModules};",
    "export const getModules = () => { if (condition) return import('node:module'); return {}; };",
    "export const getModules = () => condition ? import('node:module') : null;",
    "export function getModules() { return condition ? null : import('node:module'); }",
    "export const getModules = () => { return condition ? {modules: import('node:module')} : null; };",
    "export const getModules = () => condition && import('node:module');",
    "export const getModules = () => condition || import('node:module');",
    "export const getModules = () => condition ?? import('node:module');",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "export const inspect = () => ({});",
    "export function inspect() { return; }",
    "export function inspect() { function nested() { return import('node:module'); } return {}; }",
    "export const inspect = () => { const nested = () => import('node:module'); return 1; };",
    "const modules = await import('node:module'); export function inspect() { return modules.isBuiltin; }",
    "function getModules() { return import('node:module'); }",
    "export const inspect = () => condition ? {value: 1} : null;",
    "export function inspect() { return condition ? null : {value: 1}; }",
    "export const inspect = () => condition && {value: 1};",
    "export const inspect = () => condition || {value: 1};",
    "export const inspect = () => condition ?? {value: 1};",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("computed process destructuring preserves known loaders and rejects unknown keys", () => {
  for (const source of [
    "const {[key]: load} = process; load('node:module').createRequire;",
    "let load; ({[key]: load} = process); load('node:module').createRequire;",
    "import runtime from 'node:process'; const {[key]: load} = runtime; load('node:module').createRequire;",
    "const {['getBuiltin' + 'Module']: load} = process; load('node:module').createRequire;",
    "const key = 'getBuiltinModule'; const {[key]: load} = process; load('node:module').createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const other = {getBuiltinModule() {}}; const {[key]: load} = other; load('node:module').createRequire;",
    "function inspect(process) { const {[key]: load} = process; load('node:module').createRequire; }",
    "const {['version']: value} = process; export {value};",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("nested globalThis aliases retain the global process loader origin", () => {
  for (const receiver of [
    "globalThis.globalThis.process",
    "globalThis['globalThis']['process']",
    "globalThis.globalThis.globalThis.process",
  ])
    assert.throws(
      () =>
        validateModuleImports(
          "scripts/validate.mjs",
          `${receiver}.getBuiltinModule('node:module').createRequire;`,
          pkg,
        ),
      /createRequire bypasses/,
      receiver,
    );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "const root = globalThis.globalThis; root.process.getBuiltinModule('node:module').createRequire;",
        pkg,
      ),
    /createRequire bypasses/,
  );
  validateModuleImports(
    "scripts/validate.mjs",
    "function inspect(globalThis) { globalThis.globalThis.process.getBuiltinModule(specifier).createRequire; }",
    pkg,
  );
});

test("computed process members cannot hide loader origins or literal ownership checks", () => {
  for (const source of [
    "const key = 'getBuiltinModule'; process[key]('node:module').createRequire;",
    "process['getBuiltin' + 'Module']('node:module').createRequire;",
    "process[key]('node:module').createRequire;",
    "const runtime = process; runtime[key]('node:module').createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "process['getBuiltin' + 'Module']('yaml');",
        pkg,
      ),
    /not permitted for this owner/,
  );
  for (const source of [
    "const key = 'version'; process[key];",
    "const other = {getBuiltinModule() {}}; other[key](specifier);",
    "function inspect(process) { process[key](specifier); }",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("destructured keyed containers cannot export module-bearing values", () => {
  for (const source of [
    "const bag = {nested: {modules: await import('node:module')}}; const {nested} = bag; export {nested};",
    "const bag = {nested: {modules: await import('node:module')}}; let nested; ({nested} = bag); export default nested;",
    "export const {nested} = {nested: {modules: await import('node:module')}};",
    "const bag = [{nested: {modules: await import('node:module')}}]; const [{nested}] = bag; export {nested};",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const bag = {nested: {value: 1}, modules: await import('node:module')}; const {nested} = bag; export {nested};",
    "const bag = {nested: {createRequire() {}}}; let nested; ({nested} = bag); export default nested;",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("object rest exports exclude removed properties and retain remaining module values", () => {
  const binding =
    "const bag = {modules: await import('node:module'), safe: 1};";
  for (const source of [
    "const {modules, ...rest} = bag; export {rest};",
    "const {['modules']: omitted, ...rest} = bag; export default rest;",
    "let modules, rest; ({modules, ...rest} = bag); export {rest};",
  ])
    validateModuleImports("scripts/validate.mjs", binding + source, pkg);
  for (const source of [
    "const {safe, ...rest} = bag; export {rest};",
    "let safe, rest; ({safe, ...rest} = bag); export default rest;",
  ])
    assert.throws(
      () =>
        validateModuleImports("scripts/validate.mjs", binding + source, pkg),
      /createRequire bypasses/,
      source,
    );
});

test("unknown object property names are not assumed to match unknown rest exclusions", () => {
  const keys =
    "const sourceKey = process.argv[2]; const removeKey = process.argv[3];";
  const binding =
    keys + "const bag = {[sourceKey]: await import('node:module')};";
  for (const source of [
    "const {[removeKey]: removed, ...rest} = bag; export {rest};",
    "let removed, rest; ({[removeKey]: removed, ...rest} = bag); export default rest;",
  ])
    assert.throws(
      () =>
        validateModuleImports("scripts/validate.mjs", binding + source, pkg),
      /createRequire bypasses/,
      source,
    );
  validateModuleImports(
    "scripts/validate.mjs",
    keys +
      "const bag = {[sourceKey]: 1}; const {[removeKey]: removed, ...rest} = bag; export {rest};",
    pkg,
  );
});

test("unresolved computed assignment keys retain possible namespace selections", () => {
  const key = "const key = process.argv[2];";
  for (const source of [
    "const bag = {[key]: await import('node:module')}; let selected; ({[key]: selected} = bag); selected.createRequire;",
    "const bag = {modules: await import('node:module')}; let selected; ({[key]: selected} = bag); selected.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", key + source, pkg),
      /createRequire bypasses/,
      source,
    );
  validateModuleImports(
    "scripts/validate.mjs",
    key +
      "const bag = {[key]: {createRequire() {}}}; let selected; ({[key]: selected} = bag); selected.createRequire;",
    pkg,
  );
});

test("namespace-bearing member writes are rejected without treating ordinary writes as loaders", () => {
  for (const source of [
    "const box = {}; box.modules = await import('node:module'); box.modules.createRequire;",
    "const box = {}; box['modules'] = await import('node:module');",
    "const box = {nested: {}}; box.nested.modules = {value: await import('node:module')};",
    "const box = {}; box.modules ??= await import('node:module');",
    "const box = {}; ({modules: box.modules} = {modules: await import('node:module')});",
    "const box = {}; box.load = process.getBuiltinModule;",
    "const box = {}; box.load = require;",
    "const box = {}; box.runtime = process;",
    "const box = {}; ({getBuiltinModule: box.load} = process);",
    "const box = {}; box.load ||= require;",
    "const box = {runtime: {}}; box.runtime &&= process;",
    "const box = {}; [box.modules = await import('node:module')] = [];",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const box = {}; box.count = 1; box.modules = {createRequire() {}}; box.modules.createRequire;",
    "const box = {}; box.fs = await import('node:fs');",
    "const box = {}; ({safe: box.safe} = {safe: 1, modules: await import('node:module')});",
    "const box = {}; box.load = value => value; box.load(process.argv[2]);",
    "import {isBuiltin} from 'node:module'; const box = {}; box.check = isBuiltin;",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("object spreads retain copied module namespace origins", () => {
  for (const source of [
    "const box = {...await import('node:module')}; box.createRequire;",
    "const modules = await import('node:module'); const box = {...modules}; box['createRequire'];",
    "const box = {...require('node:module')}; const {createRequire: load} = box;",
    "const original = {...await import('node:module')}; const box = {...original}; box.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const box = {...{createRequire() {}}}; box.createRequire;",
    "const box = {...await import('node:fs')}; box.readFile;",
    "const box = {modules: await import('node:module'), safe: {createRequire() {}}}; box.safe.createRequire;",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("literal spread alternatives stop materializing after a matching module selection", (context) => {
  const spreads = 8;
  const alternatives = ["[await import('node:module')]", "[{}]"];
  const allocationBound = spreads * alternatives.length + 1;
  const source = [
    "let options;",
    ...alternatives.map((value) => `options = ${value};`),
    `const [modules] = [${Array(spreads).fill("...options").join(",")}]; modules.createRequire;`,
  ].join("\n");
  let allocations = 0;
  const original = ts.factory.createArrayLiteralExpression;
  const instrumented = context.mock.method(
    ts.factory,
    "createArrayLiteralExpression",
    (...arguments_) => {
      allocations++;
      assert.ok(
        allocations <= allocationBound,
        "An early match must not materialize the product of spread alternatives.",
      );
      return original(...arguments_);
    },
  );
  try {
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
    );
  } finally {
    instrumented.mock.restore();
  }
});

test("ambiguous spreads with no forbidden match fail at a deterministic analysis limit", () => {
  const spreads = Array(12).fill("...options").join(",");
  for (const source of [
    `let options; options = [{}]; options = [1]; const [selected] = [${spreads}]; selected.createRequire;`,
    `let options; options = {safe: 1}; options = {safe: 2}; const {omitted, ...rest} = {${spreads}}; export {rest};`,
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /Literal spread expansion exceeds the import analysis limit/,
      source,
    );

  for (const source of [
    "let options; options = [{}]; options = [1]; const [selected] = [...options, ...options]; selected.createRequire;",
    "let options; options = {safe: 1}; options = {safe: 2}; const {omitted, ...rest} = {...options, ...options}; export {rest};",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("selected getters follow explicit returns and remaining member paths", () => {
  const binding = "const modules = await import('node:module');";
  for (const source of [
    "const box = {get modules() { return modules; }}; box.modules.createRequire;",
    "const box = {get nested() { return {modules}; }}; box.nested.modules.createRequire;",
    "const box = {get modules() { if (condition) return {}; return modules; }}; box.modules.createRequire;",
    "const box = {get nested() { if (condition) return {safe: 1}; return {modules}; }}; box.nested.modules.createRequire;",
  ])
    assert.throws(
      () =>
        validateModuleImports("scripts/validate.mjs", binding + source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const box = {get modules() { function nested() { return modules; } return {createRequire() {}}; }}; box.modules.createRequire;",
    "const box = {get modules() { return modules; }, get safe() { return {createRequire() {}}; }}; box.safe.createRequire;",
  ])
    validateModuleImports("scripts/validate.mjs", binding + source, pkg);
});

test("conditional and logical initializers retain module origins through selection", () => {
  for (const source of [
    "const modules = condition ? await import('node:module') : {}; modules.createRequire;",
    "const modules = condition ? {} : await import('node:module'); modules.createRequire;",
    "const modules = condition && await import('node:module'); modules.createRequire;",
    "const modules = condition || await import('node:module'); modules.createRequire;",
    "const modules = condition ?? await import('node:module'); modules.createRequire;",
    "const {modules} = condition ? {modules: await import('node:module')} : {modules: {}}; modules.createRequire;",
    "const [modules] = condition ? [await import('node:module')] : [{}]; modules.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const modules = condition ? {createRequire() {}} : {createRequire() {}}; modules.createRequire;",
    "const {safe} = condition ? {safe: 1, modules: await import('node:module')} : {safe: 2}; export {safe};",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("exported generators cannot yield module namespaces or namespace-bearing containers", () => {
  for (const source of [
    "export async function* modules() { yield await import('node:module'); }",
    "export function* modules() { yield import('node:module'); }",
    "const modules = async function* () { yield {modules: await import('node:module')}; }; export {modules};",
    "export async function* modules() { yield* [await import('node:module')]; }",
    "export async function* modules() { return yield await import('node:module'); }",
    "export async function* modules() { yield (yield await import('node:module')); }",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "export function* values() { yield 1; yield* [2, 3]; }",
    "export function* values() { function* nested() { yield import('node:module'); } yield 1; }",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("process loader re-exports cannot escape through namespace or local alias forms", () => {
  for (const builtin of ["process", "node:process"]) {
    for (const source of [
      `export * from '${builtin}';`,
      `export * as runtime from '${builtin}';`,
      `export {default} from '${builtin}';`,
      `export {default as runtime} from '${builtin}';`,
      `export {getBuiltinModule} from '${builtin}';`,
      `export {getBuiltinModule as load} from '${builtin}';`,
      `import runtime from '${builtin}'; export {runtime};`,
      `import {getBuiltinModule as load} from '${builtin}'; export {load};`,
      "const load = process.getBuiltinModule; export default load;",
      "export const runtime = process;",
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", source, pkg),
        /createRequire bypasses/,
        source,
      );
    for (const source of [
      `export {version} from '${builtin}';`,
      `export {version as getBuiltinModule} from '${builtin}';`,
      `import {version} from '${builtin}'; export {version};`,
      "const {version} = process; export {version};",
      "export default process.version;",
      "const process = {getBuiltinModule() {}}; export {process};",
    ])
      validateModuleImports("scripts/validate.mjs", source, pkg);
  }
});

test("comma expressions use the right-hand value for origins, selections and exports", () => {
  for (const source of [
    "const modules = (0, await import('node:module')); modules.createRequire;",
    "const box = ({}, {modules: await import('node:module')}); box.modules.createRequire;",
    "export const getModules = () => (0, import('node:module'));",
    "export function getModules() { return (0, import('node:module')); }",
    "export default (0, {modules: await import('node:module')});",
    "(0, process.getBuiltinModule)('node:module').createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "const modules = (await import('node:module'), {createRequire() {}}); modules.createRequire;",
    "export const inspect = () => (import('node:module'), {});",
    "export default (await import('node:module'), 1);",
    "const passthrough = value => value; (require, passthrough)(process.argv[2]);",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "(0, require)('yaml');",
        pkg,
      ),
    /not permitted for this owner/,
  );
});

test("assignment expressions retain their resulting value for origins, selections and exports", () => {
  for (const source of [
    "let captured; const modules = (captured = await import('node:module')); modules.createRequire;",
    "let captured; (captured = await import('node:module')).createRequire;",
    "let captured; const {modules} = (captured = {modules: await import('node:module')}); modules.createRequire;",
    "let captured; const [modules] = (captured = [await import('node:module')]); modules.createRequire;",
    "let captured; export default (captured = await import('node:module'));",
    "let captured; export const getModules = () => (captured = import('node:module'));",
    "let captured; export function getModules() { return captured = import('node:module'); }",
    "let captured, alias; const modules = (captured = alias = await import('node:module')); modules.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );

  for (const source of [
    "let captured = await import('node:module'); const modules = (captured = {createRequire() {}}); modules.createRequire;",
    "let captured = await import('node:module'); export default (captured = 1);",
    "let captured; const {safe} = (captured = {safe: 1, modules: await import('node:module')}); export {safe};",
    "let captured; const load = (captured = value => value); load(process.argv[2]);",
    "function inspect(require) { let captured; (captured = require)(process.argv[2]); }",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);

  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "let captured; (captured = require)('yaml');",
        pkg,
      ),
    /not permitted for this owner/,
  );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "let captured; (captured = process.getBuiltinModule)(process.argv[2]);",
        pkg,
      ),
    /Computed imports are forbidden/,
  );
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
    "function inspect(process) { process.getBuiltinModule('node:module').createRequire; }",
    "const process = {getBuiltinModule() {}}; process.getBuiltinModule('node:module').createRequire;",
    "const other = {getBuiltinModule() {}}; other.getBuiltinModule('node:module').createRequire;",
    "process.getBuiltinModule('node:fs');",
    "const other = {default: {createRequire() {}}}; other.default.createRequire;",
    "const other = {Module: {createRequire() {}}}; const {Module: alias} = other; alias.createRequire;",
    "const other = {Module: {createRequire() {}}}; let alias; ({Module: alias} = other); alias.createRequire;",
    "import {isBuiltin as Module} from 'node:module'; Module.createRequire;",
    "export {isBuiltin as Module} from 'node:module';",
    "export * from './validate-bootstrap.mjs';",
    "export * as publication from './validate-bootstrap.mjs';",
    "import {isBuiltin} from 'node:module'; export {isBuiltin};",
    "const other = {createRequire() {}}; export default other;",
    "export const modules = {createRequire() {}};",
    "import * as modules from 'node:module'; const {isBuiltin} = modules; export {isBuiltin};",
    "import * as modules from 'node:module'; export const {isBuiltin} = modules;",
    "const modules = {createRequire() {}}; export {modules as named};",
    "export function helper() {}",
    "const local = {}; export {local};",
    "const other = {createRequire() {}}; other['create' + 'Require'];",
    "function inspect(require) { const load = require; load('node:module').createRequire; }",
    "function inspect(process) { const load = process.getBuiltinModule; load('node:module').createRequire; }",
    "import * as process from 'node:process'; function inspect(process) { const load = process.getBuiltinModule; load('node:module').createRequire; }",
    "const process = {getBuiltinModule() {}}; let load; load = process.getBuiltinModule; load('node:module').createRequire;",
    "const other = {getBuiltinModule() {}}; const {getBuiltinModule: load} = other; load('node:module').createRequire;",
    "const other = {getBuiltinModule() {}}; let load; ({getBuiltinModule: load} = other); load('node:module').createRequire;",
    "const unrelated = () => ({}); let load; load = unrelated; load('node:module').createRequire;",
    "let load; let alias; load = alias; alias = load; load('node:module').createRequire;",
    "const {isBuiltin} = await import('node:module'); const load = isBuiltin; load('node:module').createRequire;",
    "const other = {createRequire() {}}; const {...rest} = other; rest.createRequire;",
    "const other = {createRequire() {}}; let rest; ({...rest} = other); rest.createRequire;",
    "const local = {createRequire() {}}; export default {local};",
    "export default {nested: {createRequire() {}}};",
    "export default {...{createRequire() {}}};",
    "export default {get modules() { return {}; }};",
    "export default {isBuiltin: (await import('node:module')).isBuiltin};",
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
