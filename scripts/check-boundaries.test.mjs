import assert from "node:assert/strict";
import {
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

import ts from "typescript";

import {
  boundaryViolation,
  checkBoundaries,
  inspectBoundaries,
  inspectImports,
  validateModuleImports,
  validateStandalonePackage,
} from "./check-boundaries.mjs";
import { publicationInventories } from "./validate-bootstrap.mjs";

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
    "src/features/auth/login/Login.tsx",
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
  const owner = path.join(root, "src/i18n/catalog-data/website-types.ts");
  const type = path.join(root, "src/i18n/catalog-data/locales.ts");
  assert.equal(check("./locales.ts", type, owner, true), undefined);
  assert.ok(check("./locales.ts", type, owner, false));
  const [fallback] = inspectImports(
    'import english from "./locales/en.json"; export default { ...english };',
  );
  assert.ok(
    check(
      fallback.specifier,
      path.join(root, "src/i18n/catalog-data/locales/en.json"),
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
});

test("catalog JSON imports require exact resources, registry and erased type owners", () => {
  const registry = path.join(root, "src/i18n/catalogs.ts");
  const types = path.join(root, "src/i18n/catalog-data/website-types.ts");
  for (const code of [
    "ar",
    "de",
    "en",
    "es",
    "fa",
    "fr",
    "it",
    "pt",
    "ru",
    "tr",
  ]) {
    const specifier = `@/i18n/catalog-data/locales/${code}.json`;
    const target = path.join(
      root,
      `src/i18n/catalog-data/locales/${code}.json`,
    );
    assert.equal(check(specifier, target, registry), undefined);
    assert.ok(check(specifier, target, registry, true));
    assert.ok(check(specifier, target, file));
    assert.ok(check(specifier, target, types, true));
    assert.ok(check(specifier.replace(".json", ""), target, registry));
    assert.ok(check(`./locales/${code}.json`, target, types, false));
    assert.equal(
      check(`./locales/${code}.json`, target, types, true) === undefined,
      code === "en",
    );
  }
  for (const target of [
    "src/i18n/catalog-data/locales/xx.json",
    "src/i18n/catalog-data/locales/en.ts",
    "src/i18n/catalog-data/other.json",
    "package.json",
  ])
    assert.ok(check("@/" + target.slice(4), path.join(root, target), registry));
  assert.ok(
    check(
      "@/i18n/catalog-data/locales/en.json",
      path.resolve(root, "../other/src/i18n/catalog-data/locales/en.json"),
      registry,
    ),
  );
});

test("the standalone bootstrap error owns only exact English and Persian runtime catalog imports", () => {
  const bootstrap = path.join(root, "src/app/global-error.tsx");
  const english = "src/i18n/catalog-data/locales/en.json";
  const persian = "src/i18n/catalog-data/locales/fa.json";
  for (const target of [english, persian]) {
    const specifier = "@/" + target.slice("src/".length);
    const resolved = path.join(root, target);
    assert.equal(check(specifier, resolved, bootstrap), undefined);
    assert.ok(check(specifier, resolved, bootstrap, true));
    for (const owner of [
      "src/app/error.tsx",
      "src/app/layout.tsx",
      "src/app/_components/Header.tsx",
      "src/app/global-error-other.tsx",
    ])
      assert.ok(check(specifier, resolved, path.join(root, owner)));
    for (const alias of [
      `../i18n/catalog-data/locales/${path.basename(target)}`,
      specifier.replace(".json", ""),
      specifier.replace("/catalog-data/", "/catalog-data/../catalog-data/"),
    ])
      assert.ok(check(alias, resolved, bootstrap));
    assert.ok(
      check(
        specifier,
        path.join(root, target === english ? persian : english),
        bootstrap,
      ),
    );
    assert.ok(
      check(specifier, path.resolve(root, "../foreign", target), bootstrap),
    );
  }
  for (const code of ["ar", "de", "es", "fr", "it", "pt", "ru", "tr"])
    assert.ok(
      check(
        `@/i18n/catalog-data/locales/${code}.json`,
        path.join(root, `src/i18n/catalog-data/locales/${code}.json`),
        bootstrap,
      ),
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
      check(specifier, path.resolve(root, "../outside-project/src/private.ts")),
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

test("operational runners and Lighthouse stay outside every product import boundary", () => {
  const owner = path.join(root, "src/app/page.tsx");
  for (const [specifier, location] of [
    ["../../scripts/operations-checks.mjs", "scripts/operations-checks.mjs"],
    [
      "../../scripts/run-website-performance.mjs",
      "scripts/run-website-performance.mjs",
    ],
    ["../../scripts/run-docker-smoke.mjs", "scripts/run-docker-smoke.mjs"],
  ])
    assert.match(
      check(specifier, path.join(root, location), owner),
      /only to published local production modules/,
    );
  assert.match(
    check(
      "lighthouse",
      path.join(root, "node_modules/lighthouse/core/index.js"),
      owner,
      false,
      "lighthouse",
    ),
    /exact owner/,
  );
  assert.match(
    check(
      "lighthouse",
      path.join(root, "node_modules/lighthouse/core/index.d.ts"),
      owner,
      true,
      "lighthouse",
    ),
    /exact owner/,
  );
});

test("the reviewed phase has its exact owned production module count", async () => {
  const result = await checkBoundaries();
  const { phase } = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const reviewedSourceCounts = {
    foundation: 10,
    "client-foundation": 34,
    features: 55,
    "runners-foundation": 55,
    "browser-foundation": 55,
    application: 80,
    operations: 80,
  };
  assert.equal(result.files, reviewedSourceCounts[phase]);
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
  const util = path.join(root, "src/shared/lib/cn.ts");
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

test("runtime adapters have exact server, client and installed package permissions", () => {
  const nonce = path.join(root, "src/shared/security/nonce.ts");
  const serverLanguage = path.join(root, "src/shared/settings/server.ts");
  const headers = path.join(root, "node_modules/next/headers.d.ts");
  const server = path.join(root, "node_modules/next/server.d.ts");
  const serverOnly = path.join(root, "node_modules/server-only/index.js");
  assert.equal(check("next/headers", headers, nonce, false, "next"), undefined);
  assert.equal(
    check("next/server", server, serverLanguage, false, "next"),
    undefined,
  );
  assert.equal(
    check("server-only", serverOnly, nonce, false, "server-only"),
    undefined,
  );
  assert.ok(check("next/headers", headers, serverLanguage, false, "next"));
  assert.ok(check("next/headers", headers, nonce, true, "next"));
  assert.ok(check("server-only", serverOnly, nonce, false, "next"));
  assert.ok(check("server-only", serverOnly, file, false, "server-only"));
  const home = path.join(root, "src/features/home/Home.tsx");
  const serverIntl = path.join(root, "node_modules/next-intl/server.d.ts");
  assert.equal(
    check("next-intl/server", serverIntl, home, false, "next-intl"),
    undefined,
  );
  assert.ok(check("next-intl/server", serverIntl, file, false, "next-intl"));
  assert.ok(check("next-intl/server", serverIntl, home, true, "next-intl"));
  assert.ok(
    check(
      "@/app/layout",
      path.join(root, "src/app/layout.tsx"),
      serverLanguage,
    ),
  );
});

test("only the root layout may load the exact global stylesheet at runtime", () => {
  const layout = path.join(root, "src/app/layout.tsx");
  const style = path.join(root, "src/app/globals.css");
  assert.equal(check("./globals.css", style, layout), undefined);
  assert.ok(check("./globals.css", style, layout, true));
  assert.ok(check("@/app/globals.css", style, layout));
  assert.ok(check("./globals.css", style, file));
  assert.ok(
    check("./foreign.css", path.join(root, "src/app/foreign.css"), layout),
  );
  assert.ok(check("./globals.css", undefined, layout));
});

test("UI dependencies remain exact per owner, package location and erased/runtime phase", () => {
  const button = path.join(root, "src/shared/ui/button.tsx");
  const session = path.join(
    root,
    "src/features/auth/session/SessionProvider.tsx",
  );
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
    "src/shared/ui/dialog.tsx",
  ])
    assert.ok(check("./target", path.join(root, target), session));
});

test("feature forms restrict framework navigation to exact owners and runtime permissions", () => {
  const login = path.join(root, "src/features/auth/login/Login.tsx");
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
    "src/features/auth/register/Register.tsx",
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
    "server-only": "0.0.1",
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

test("then callbacks cannot forward module namespaces into local receivers or exports", () => {
  for (const source of [
    "const modules = await import('node:module').then(value => value); modules.createRequire;",
    "const modules = await import('node:module').then(value => { return value; }); modules.createRequire;",
    "const modules = await import('node:module').then(function (value) { return value; }); modules.createRequire;",
    "const modules = await import('node:module').then(({default: value}) => value); modules.createRequire;",
    "const modules = await import('node:module').then(value => { const alias = value; return alias; }); modules.createRequire;",
    "const modules = await import('node:module')['then'](value => value); modules.createRequire;",
    "export function getModules() { return import('node:module').then(value => value); }",
    "export const getModules = () => import('node:module').then(value => value);",
    "export default import('node:module').then(value => value);",
    "export default import('node:module').then(value => ({modules: value}));",
    "const box = await import('node:module').then(value => ({modules: value})); box.modules.createRequire;",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
});

test("then forwarding follows receiver aliases, callback aliases and chained results", () => {
  for (const source of [
    "const pending = import('node:module'); const modules = await pending.then(value => value); modules.createRequire;",
    "let pending; pending = import('node:module'); export default pending.then(value => value);",
    "const forward = value => value; const modules = await import('node:module').then(forward); modules.createRequire;",
    "const forward = value => value; const alias = forward; export default import('node:module').then(alias);",
    "function forward(value) { return value; } export default import('node:module').then(forward);",
    "const modules = await import('node:module').then(value => value).then(next => next); modules.createRequire;",
    "const modules = await import('node:module').then(value => ({modules: value})).then(({modules}) => modules); modules.createRequire;",
    "const pending = import('node:module').then(value => value); export default pending.then(next => next);",
    "let pending; pending = import('node:module').then(value => condition ? pending : value); export {pending};",
    "const forward = value => condition ? forward : value; export default import('node:module').then(forward);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
});

test("then callback provenance preserves safe results, lexical scope and independent calls", () => {
  for (const source of [
    "export default import('node:module').then(() => ({}));",
    "const modules = await import('node:module').then(value => ({createRequire() {}})); modules.createRequire;",
    "export default import('node:module').then(value => value.isBuiltin);",
    "export default import('node:module').then(({isBuiltin}) => isBuiltin);",
    "export default import('node:module').then(value => { function unused() { return value; } return {}; });",
    "const forward = value => value; export default import('node:fs').then(forward);",
    "const forward = value => value; const unused = import('node:module').then(forward); export default import('node:fs').then(forward);",
    "const value = await import('node:module'); export default import('node:fs').then(value => value);",
    "const forward = value => value; export function getSafe() { const forward = value => ({}); return import('node:module').then(forward); }",
    "export default import('node:module').then(value => value).then(() => ({}));",
    "let pending; pending = import('node:module').then(value => pending); export {pending};",
    "const first = value => second; const second = value => first; export default import('node:module').then(first);",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("long then chains preserve safe transformations and module-bearing results", () => {
  const chain = ".then(value => value)".repeat(24);
  for (const source of [
    "export default import('node:fs')" + chain,
    "export default import('node:module')" + chain + ".then(() => ({}))",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);

  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "export default import('node:module')" + chain,
        pkg,
      ),
    /createRequire bypasses/,
  );
});

test("branching then traversal fails at a deterministic analysis limit", () => {
  const branch = ".then(value => condition ? value : value)";
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "export default import('node:fs')" + branch.repeat(16),
        pkg,
      ),
    /Promise callback traversal exceeds the import analysis limit/,
  );
  validateModuleImports(
    "scripts/validate.mjs",
    "export default import('node:fs')" + branch.repeat(3),
    pkg,
  );
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        "export default import('node:module')" + branch.repeat(16),
        pkg,
      ),
    /createRequire bypasses/,
  );
});

test("non-callable then handlers preserve the receiver without tainting callable shadows", () => {
  for (const handler of [
    "",
    "null",
    "undefined",
    "void 0",
    "false",
    "0",
    "1n",
    "'ignored'",
    "/ignored/",
    "{}",
    "[]",
  ]) {
    const pending = `import('node:module').then(${handler})`;
    for (const source of [
      `export default ${pending};`,
      `const modules = await ${pending}; modules.createRequire;`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", source, pkg),
        /createRequire bypasses/,
        source,
      );
    validateModuleImports(
      "scripts/validate.mjs",
      `export default import('node:fs').then(${handler});`,
      pkg,
    );
  }
  for (const source of [
    "const pending = import('node:module'); export default pending.then();",
    "const handler = null; export default import('node:module').then(handler);",
    "const handler = undefined; const alias = handler; export default import('node:module').then(alias);",
    "const undefined = 0; export default import('node:module').then(undefined);",
    "const handler = condition ? null : () => ({}); export default import('node:module').then(handler);",
    "export default import('node:module').then(null, () => ({}));",
    "export default import('node:module').then().then(value => value);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "export default import('node:module').then(() => null);",
    "export default import('node:module').then(() => undefined);",
    "const undefined = () => ({}); export default import('node:module').then(undefined);",
    "function undefined() { return {}; } export default import('node:module').then(undefined);",
    "const handler = () => ({}); export default import('node:module').then(handler);",
    "export default import('node:module').then(() => ({})).then();",
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);
});

test("then spread arguments select the first expanded handler and preserve possible pass-through", () => {
  const safe = "const safe = () => ({});";
  for (const arguments_ of [
    "...[]",
    "...[null]",
    "...[undefined]",
    "...[value => value]",
    "...[, safe]",
    "...[...[], value => value]",
    "...[...(condition ? [safe] : unknown)]",
    "...unknown",
    "...[], ...unknown",
    "...unknown, safe",
    "...(condition ? [safe] : unknown)",
    "...(condition ? unknown : [safe])",
  ]) {
    const pending = `import('node:module').then(${arguments_})`;
    for (const source of [
      `export default ${pending};`,
      `const modules = await ${pending}; modules.createRequire;`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", safe + source, pkg),
        /createRequire bypasses/,
        source,
      );
  }
  for (const source of [
    "const args = []; export default import('node:module').then(...args);",
    "const args = [null]; const alias = args; const modules = await import('node:module').then(...alias); modules.createRequire;",
    "const args = condition ? [] : [safe]; export default import('node:module').then(...args);",
    "const args = condition ? [safe] : unknown; export default import('node:module').then(...args);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", safe + source, pkg),
      /createRequire bypasses/,
      source,
    );
  for (const source of [
    "export default import('node:module').then(...[() => ({})]);",
    "export default import('node:module').then(...[], safe);",
    "export default import('node:module').then(...[], ...[], safe);",
    "export default import('node:module').then(...[...[], safe]);",
    "export default import('node:module').then(safe, ...unknown);",
    "export default import('node:module').then(...[safe], ...unknown);",
    "export default import('node:module').then(...(condition ? [safe] : [() => ({})]));",
    "const args = [safe]; const alias = args; export default import('node:module').then(...alias);",
    "const empty = []; const args = [...empty, safe]; export default import('node:module').then(...args);",
    "export default import('node:fs').then(...unknown);",
  ])
    validateModuleImports("scripts/validate.mjs", safe + source, pkg);
});

test("null and global undefined in nullish handlers select only their fallback", () => {
  const safe = "const safe = () => ({});";
  for (const source of [
    "export default import('node:module').then(null ?? (() => ({})));",
    "export default import('node:module').then((null) ?? safe);",
    "export default import('node:module').then(null ?? (null ?? safe));",
    "const handler = null ?? safe; export default import('node:module').then(handler);",
    "export default import('node:module').then(...[(undefined) ?? safe]);",
    "const modules = await import('node:module').then(null ?? (() => ({createRequire() {}}))); modules.createRequire;",
  ])
    validateModuleImports("scripts/validate.mjs", safe + source, pkg);

  for (const source of [
    "export default import('node:module').then(null ?? (value => value));",
    "export default import('node:module').then(null ?? undefined);",
    "export default import('node:module').then(0 ?? safe);",
    "export default import('node:module').then(undefined ?? (value => value));",
    "const undefined = value => value; export default import('node:module').then(undefined ?? safe);",
  ])
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", safe + source, pkg),
      /createRequire bypasses/,
      source,
    );
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

test("ordinary literal entries do not exhaust the spread budget", () => {
  const elements = Array(300).fill("0").join(",");
  const properties = Array.from(
    { length: 300 },
    (_, index) => `value${index}: 0`,
  ).join(",");
  for (const source of [
    `const [first] = [${elements}]; export {first};`,
    `const {value0, ...rest} = {${properties}}; export {rest};`,
    `const [first] = [${elements}, ...[{}], ${elements}]; export {first};`,
    `const {value0, ...rest} = {${properties}, ...{extra: 1}, ${properties}}; export {rest};`,
  ])
    validateModuleImports("scripts/validate.mjs", source, pkg);

  const mixed = Array(8).fill(`${elements}, ...options`).join(",");
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        `let options; options = [{}]; options = [1]; const [first] = [${mixed}]; first.createRequire;`,
        pkg,
      ),
    /Literal spread expansion exceeds the import analysis limit/,
  );
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

test("logical assignment results retain both possible operand values", () => {
  for (const operator of ["??=", "||=", "&&="]) {
    for (const source of [
      `let captured; export default (captured ${operator} await import('node:module'));`,
      `let captured = await import('node:module'); export default (captured ${operator} {});`,
      `let captured; (captured ${operator} await import('node:module')).createRequire;`,
      `let captured; const {modules} = (captured ${operator} {modules: await import('node:module')}); modules.createRequire;`,
      `let captured; export const getModules = () => (captured ${operator} import('node:module'));`,
    ])
      assert.throws(
        () => validateModuleImports("scripts/validate.mjs", source, pkg),
        /createRequire bypasses/,
        source,
      );

    for (const source of [
      `let captured = {createRequire() {}}; export default (captured ${operator} {});`,
      `let captured; const {safe} = (captured ${operator} {safe: 1, modules: await import('node:module')}); export {safe};`,
      `function inspect(require) { let captured; (captured ${operator} require)(process.argv[2]); }`,
    ])
      validateModuleImports("scripts/validate.mjs", source, pkg);

    assert.throws(
      () =>
        validateModuleImports(
          "scripts/validate.mjs",
          `let captured; (captured ${operator} require)('yaml');`,
          pkg,
        ),
      /not permitted for this owner/,
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
    true,
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

test("governance imports use the actual phase rather than unpublished future local edges", () => {
  const source = 'export {} from "../src/app/page.tsx";';
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/validate.mjs",
        source,
        pkg,
        publicationInventories.foundation,
      ),
    /reviewed publication/,
  );
  validateModuleImports(
    "scripts/validate.mjs",
    source,
    pkg,
    publicationInventories.application,
  );
});

test("the optional lab owner may import its declared literal SDKs without computed imports", () => {
  const declared = {
    ...pkg,
    devDependencies: {
      ...pkg.devDependencies,
      lighthouse: "13.6.0",
      "@playwright/test": "1.64.1",
    },
  };
  for (const specifier of [
    "lighthouse",
    "@playwright/test",
    "lighthouse/core/config/lr-desktop-config.js",
  ]) {
    const source = `await import(${JSON.stringify(specifier)});`;
    validateModuleImports(
      "scripts/run-website-performance.mjs",
      source,
      declared,
    );
    assert.throws(
      () => validateModuleImports("scripts/validate.mjs", source, declared),
      /not permitted for this owner/,
    );
  }
  assert.throws(
    () =>
      validateModuleImports(
        "scripts/run-website-performance.mjs",
        "await import(installation.lighthouse);",
        pkg,
      ),
    /Computed imports are forbidden/,
  );
});
