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
const check = (
  specifier,
  resolved,
  owner = file,
  typeOnly = false,
  resolvedPackage,
) =>
  boundaryViolation({
    root,
    file: owner,
    specifier,
    resolved,
    typeOnly,
    resolvedPackage,
  });

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

test("catalog data uses erased local types without runtime imports or fallback catalogs", () => {
  const owner = path.join(root, "src/i18n/catalog-data/locales/fa.ts");
  const type = path.join(root, "src/i18n/catalog-data/website-types.ts");
  assert.equal(check("../website-types.ts", type, owner, true), undefined);
  assert.ok(check("../website-types.ts", type, owner, false));
  const [fallback] = inspectImports(
    'import english from "./en.ts"; export default { ...english };',
  );
  assert.ok(
    check(
      fallback.specifier,
      path.join(root, "src/i18n/catalog-data/locales/en.ts"),
      owner,
      fallback.typeOnly,
    ),
  );
  assert.ok(check("next-intl", undefined, owner));
  assert.ok(
    check("../../request", path.join(root, "src/i18n/request.ts"), owner, true),
  );
  assert.ok(
    check(
      "../../catalogs",
      path.join(root, "src/i18n/catalogs.ts"),
      owner,
      true,
    ),
  );
  assert.ok(check("@/i18n/catalog-data/website-types", type, owner, true));
  assert.equal(
    check(
      "@/i18n/catalog-data/locales/fa",
      path.join(root, "src/i18n/catalog-data/locales/fa.ts"),
      path.join(root, "src/i18n/catalogs.ts"),
    ),
    undefined,
  );
});

test("the import graph distinguishes erased declarations from module-loading edges", () => {
  const edges = inspectImports(`
import type Shape from "./shape";
import { type Shape } from "./shape";
export type { Shape } from "./shape";
type Other = import("./shape").Shape;
import Runtime from "./runtime";
`);
  assert.deepEqual(
    edges.map((edge) => edge.typeOnly),
    [true, false, true, true, false],
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
      message.includes("exactly its declared"),
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

test("the feature-ui phase has sixty-six explicitly owned production modules", async () => {
  const result = await checkBoundaries();
  assert.equal(result.files, 66);
  assert.deepEqual(result.violations, []);
});

test("only exact owners can use their installed packages with the declared import phase", () => {
  const metadata = path.join(root, "src/shared/seo/metadata.ts");
  const framework = path.join(root, "node_modules/next/types/index.d.ts");
  assert.equal(check("next", framework, metadata, true, "next"), undefined);
  assert.ok(check("next", framework, metadata, false, "next"));
  assert.ok(check("next", framework, file, true, "next"));
  assert.ok(check("next/headers", framework, metadata, true, "next"));
  assert.ok(check("next", framework, metadata, true, "other-package"));
  assert.ok(
    check(
      "next",
      path.resolve(root, "../other/node_modules/next/index.d.ts"),
      metadata,
      true,
      "next",
    ),
  );
  const util = path.join(root, "src/lib/utils.ts");
  assert.equal(
    check(
      "clsx",
      path.join(root, "node_modules/clsx/clsx.d.mts"),
      util,
      false,
      "clsx",
    ),
    undefined,
  );
  assert.ok(
    check(
      "clsx",
      path.join(root, "node_modules/clsx/clsx.d.mts"),
      util,
      true,
      "clsx",
    ),
  );
  assert.ok(
    check(
      "next",
      framework,
      path.join(root, "src/i18n/catalog-data/locales/fa.ts"),
      true,
      "next",
    ),
  );
});

test("the font manifest belongs only to its preload helper", () => {
  const manifest = path.join(root, "src/shared/fonts/manifest.json");
  const owner = path.join(root, "src/shared/fonts/preloads.ts");
  assert.equal(check("./manifest.json", manifest, owner), undefined);
  assert.ok(check("./manifest.json", manifest, file));
  assert.ok(check("./manifest.json", manifest, owner, true));
});

test("UI dependencies remain exact per owner, package location and erased/runtime phase", () => {
  const button = path.join(root, "src/components/ui/button.tsx");
  const session = path.join(root, "src/features/auth/SessionProvider.tsx");
  const types = path.join(root, "node_modules/@types/react/index.d.ts");
  assert.equal(check("react", types, button, true, "@types/react"), undefined);
  assert.ok(check("react", types, button, false, "@types/react"));
  assert.equal(
    check("react", types, session, false, "@types/react"),
    undefined,
  );
  assert.ok(check("react", types, session, false, "react"));
  assert.ok(
    check(
      "react",
      path.join(root, "node_modules/other/index.d.ts"),
      session,
      false,
      "@types/react",
    ),
  );
  const radix = path.join(root, "node_modules/radix-ui/dist/index.d.ts");
  assert.equal(check("radix-ui", radix, button, false, "radix-ui"), undefined);
  assert.ok(check("radix-ui", radix, session, false, "radix-ui"));
  assert.ok(check("radix-ui", radix, button, true, "radix-ui"));
  const vitals = path.join(root, "node_modules/next/web-vitals.d.ts");
  assert.equal(
    check(
      "next/web-vitals",
      vitals,
      path.join(root, "src/shared/performance/WebVitals.tsx"),
      false,
      "next",
    ),
    undefined,
  );
  assert.ok(
    check(
      "next/web-vitals",
      vitals,
      path.join(root, "src/shared/performance/web-vitals.ts"),
      false,
      "next",
    ),
  );
  for (const target of [
    "src/test/setup.ts",
    "src/test/intl.ts",
    "src/app/layout.tsx",
    "src/components/ui/dialog.tsx",
  ])
    assert.ok(check("./target", path.join(root, target), session));
});

test("feature forms restrict framework navigation to exact owners and runtime permissions", () => {
  const login = path.join(root, "src/features/login/Login.tsx");
  const otp = path.join(root, "src/features/auth/OtpForm.tsx");
  const account = path.join(root, "src/features/account/Account.tsx");
  const navigation = path.join(root, "node_modules/next/navigation.d.ts");
  const link = path.join(root, "node_modules/next/link.d.ts");
  assert.equal(
    check("next/navigation", navigation, login, false, "next"),
    undefined,
  );
  assert.equal(
    check("next/navigation", navigation, account, false, "next"),
    undefined,
  );
  assert.equal(check("next/link", link, otp, false, "next"), undefined);
  assert.ok(check("next/navigation", navigation, login, true, "next"));
  assert.ok(check("next/link", link, account, false, "next"));
  for (const target of [
    "src/shared/hooks/use-operation-scope.ts",
    "src/shared/navigation/document.ts",
    "src/features/register/Register.tsx",
  ])
    assert.ok(
      check(
        "next/navigation",
        navigation,
        path.join(root, target),
        false,
        "next",
      ),
    );
  assert.ok(
    check(
      "next/server",
      path.join(root, "node_modules/next/server.d.ts"),
      login,
      false,
      "next",
    ),
  );
});

test("package names cannot conceal local links, aliases or repository dependencies", async (context) => {
  const parent = path.resolve(os.tmpdir());
  const fixture = await mkdtemp(path.join(parent, "kernel-package-boundary-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(fixture)), parent);
    assert.ok(path.basename(fixture).startsWith("kernel-package-boundary-"));
    await rm(fixture, { recursive: true, force: true });
  });
  await mkdir(path.join(fixture, "src"));
  await writeFile(
    path.join(fixture, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { moduleResolution: "bundler", module: "esnext" },
      include: ["src/**/*.ts"],
    }),
  );
  await writeFile(path.join(fixture, "src/unpublished.ts"), "export {};\n");
  const dependencies = {
    "class-variance-authority": "0.7.1",
    "lucide-react": "1.62.0",
    motion: "14.6.0",
    "next-themes": "0.4.6",
    "radix-ui": "1.8.1",
    clsx: "2.1.1",
    next: "16.4.3",
    "next-intl": "4.14.9",
    react: "19.3.1",
    "react-dom": "19.3.1",
    "tailwind-merge": "3.7.0",
  };
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({ dependencies }),
  );
  assert.equal(
    (await checkBoundaries(fixture)).violations.some((value) =>
      value.includes("exactly its declared"),
    ),
    false,
  );
  for (const version of [
    "file:../other",
    "link:../other",
    "workspace:*",
    "npm:other@1.0.0",
    "https://example.test/package.tgz",
    "git+https://example.test/repo.git",
  ]) {
    await writeFile(
      path.join(fixture, "package.json"),
      JSON.stringify({ dependencies: { ...dependencies, next: version } }),
    );
    assert.ok(
      (await checkBoundaries(fixture)).violations.some((value) =>
        value.includes("exactly its declared"),
      ),
    );
    await writeFile(
      path.join(fixture, "package.json"),
      JSON.stringify({ dependencies, devDependencies: { external: version } }),
    );
    assert.ok(
      (await checkBoundaries(fixture)).violations.some((value) =>
        value.includes("must not link"),
      ),
    );
  }
});
