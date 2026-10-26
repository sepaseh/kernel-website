import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  boundaryViolation,
  checkBoundaries,
  inspectImports,
} from "./check-boundaries.mjs";

const root = path.resolve("fixture");
const file = path.join(root, "src/shared/settings/language.ts");
const check = (specifier, resolved, owner = file) =>
  boundaryViolation({ root, file: owner, specifier, resolved });

test("captures static, erased, re-export, dynamic and require dependencies", () => {
  const edges = inspectImports(`
import type { User } from "external";
export { value } from "./local";
type Shape = import("./types").Shape;
const one = import("./one");
const two = require("./two");
import other = require("./other");
const computed = import(variable);
// import("not-a-dependency")
`);
  assert.deepEqual(
    edges.map((edge) => edge.specifier),
    ["external", "./local", "./types", "./one", "./two", "./other", undefined],
  );
});

test("production imports resolve only to published production modules", () => {
  assert.equal(
    check("./contracts", path.join(root, "src/shared/settings/contracts.ts")),
    undefined,
  );
  assert.equal(
    check("@/shared/api/origin", path.join(root, "src/shared/api/origin.ts")),
    undefined,
  );
  assert.equal(
    check(
      "@/i18n/catalog-data/locales",
      path.join(root, "src/i18n/catalog-data/locales.ts"),
    ),
    undefined,
  );
  for (const target of [
    "src/shared/settings/language.test.ts",
    "src/features/login/Login.tsx",
    "src/shared/api/not-published.ts",
    "node_modules/react/index.js",
    "node_modules/@libsql/client/index.js",
  ])
    assert.ok(check("alias", path.join(root, target)), target);
});

test("external packages, built-in modules and computed imports are not production dependencies", () => {
  for (const name of [
    "react",
    "next/headers",
    "vitest",
    "node:fs",
    "hono",
    "@kernel/api",
    undefined,
  ])
    assert.ok(check(name), String(name));
  assert.deepEqual(
    inspectImports("const mode = process.env.API_BASE_URL; new URL(mode);"),
    [],
  );
});

test("relative and aliased imports cannot escape into another checkout", () => {
  for (const specifier of [
    "../../../other/private.ts",
    "@/hidden",
    "custom-alias",
  ])
    assert.ok(
      check(specifier, path.resolve(root, "../kernel-api/src/private.ts")),
    );
});

test("wire contracts cannot import behavior even through a resolved alias", () => {
  const owner = path.join(root, "src/features/account/types.ts");
  assert.equal(
    check(
      "@/shared/contracts",
      path.join(root, "src/shared/contracts/index.ts"),
      owner,
    ),
    undefined,
  );
  assert.ok(
    check(
      "@/shared/contracts",
      path.join(root, "src/shared/settings/language.ts"),
      owner,
    ),
  );
  assert.ok(
    check(
      "./language",
      path.join(root, "src/shared/settings/language.ts"),
      path.join(root, "src/shared/settings/contracts.ts"),
    ),
  );
});

test("the checker rejects unresolved imports and undeclared runtime dependencies", async (context) => {
  const parent = path.resolve(os.tmpdir());
  const fixture = await mkdtemp(path.join(parent, "kernel-website-boundary-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(fixture)), parent);
    assert.ok(path.basename(fixture).startsWith("kernel-website-boundary-"));
    await rm(fixture, { recursive: true, force: true });
  });
  await mkdir(path.join(fixture, "src/shared/lib"), { recursive: true });
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({ dependencies: { react: "0.0.0" } }),
  );
  await writeFile(
    path.join(fixture, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { moduleResolution: "bundler", module: "esnext" },
      include: ["src/**/*.ts"],
    }),
  );
  await writeFile(
    path.join(fixture, "src/shared/lib/form-values.ts"),
    'import "./missing";\n',
  );
  const result = await checkBoundaries(fixture);
  assert.ok(
    result.violations.some((message) =>
      message.includes("no runtime dependencies"),
    ),
  );
  assert.ok(
    result.violations.some((message) => message.includes("must resolve")),
  );

  await writeFile(path.join(fixture, "package.json"), "{}");
  await writeFile(
    path.join(fixture, "src/shared/lib/form-values.test.ts"),
    "export const value = 1;",
  );
  await writeFile(
    path.join(fixture, "src/shared/lib/form-values.ts"),
    'import "./form-values.test";\n',
  );
  const testImport = await checkBoundaries(fixture);
  assert.ok(
    testImport.violations.some((message) =>
      message.includes("published local production"),
    ),
  );

  await mkdir(path.join(fixture, "other"));
  await writeFile(
    path.join(fixture, "other/local.ts"),
    "export const value = 1;",
  );
  await writeFile(
    path.join(fixture, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        module: "esnext",
        paths: { "@/escape": ["./other/local.ts"] },
      },
      include: ["src/**/*.ts"],
    }),
  );
  await writeFile(
    path.join(fixture, "src/shared/lib/form-values.ts"),
    'import "@/escape";\n',
  );
  const aliasImport = await checkBoundaries(fixture);
  assert.ok(
    aliasImport.violations.some((message) =>
      message.includes("published local production"),
    ),
  );

  await symlink(
    path.join(fixture, "other"),
    path.join(fixture, "src/linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    checkBoundaries(fixture),
    /must not follow symbolic links/,
  );
});

test("the exact foundation has ten closed production modules", async () => {
  const result = await checkBoundaries();
  assert.equal(result.files, 10);
  assert.deepEqual(result.violations, []);
});
