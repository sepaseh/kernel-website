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

import {
  inspectBootstrap,
  validateBootstrapPolicy,
} from "./validate-bootstrap.mjs";

const deliveryPublishedFiles = [
  ".dockerignore",
  ".env.example",
  ".release-please-manifest.json",
  "CHANGELOG.fa.md",
  "CHANGELOG.md",
  "deploy/docker/.env.example",
  "deploy/docker/15-validate-configuration.sh",
  "deploy/docker/compose.yaml",
  "deploy/docker/Dockerfile",
  "deploy/docker/nginx.conf.template",
  "deploy/docker/README.fa.md",
  "deploy/docker/README.md",
  "deploy/docker/website-entrypoint.sh",
  "deploy/native/hosts.env.example",
  "deploy/native/nginx/bootstrap.conf.template",
  "deploy/native/nginx/kernel.conf.template",
  "deploy/native/README.fa.md",
  "deploy/native/README.md",
  "deploy/native/systemd/kernel-website.service",
  "deploy/native/website.env.example",
  "docs/deployment.fa.md",
  "docs/deployment.md",
  "docs/release-operations.fa.md",
  "docs/release-operations.md",
  "docs/releasing.fa.md",
  "docs/releasing.md",
  "docs/security/authentication-review.fa.md",
  "docs/security/authentication-review.md",
  "docs/security/reviews.fa.md",
  "docs/security/reviews.md",
  "docs/security/threat-model.fa.md",
  "docs/security/threat-model.md",
  "docs/staging.fa.md",
  "docs/staging.md",
  "release-please-config.json",
  "scripts/deployment.test.mjs",
  "scripts/docker-smoke-cleanup.mjs",
  "scripts/docker-smoke-cleanup.test.mjs",
  "scripts/healthcheck.mjs",
  "scripts/package-release.mjs",
  "scripts/package-release.test.mjs",
  "scripts/prepare-standalone.mjs",
  "scripts/prepare-standalone.test.mjs",
  "scripts/release-files.mjs",
  "scripts/release-files.test.mjs",
  "scripts/render-deployment.mjs",
  "scripts/validate-deployment-env.mjs",
  "scripts/validate-workflow-targets.mjs",
  "scripts/validate-workflow-targets.test.mjs",
];
const readPublicationPolicy = async () =>
  JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
const integrationPolicy = async () => {
  const declared = await readPublicationPolicy();
  return {
    ...declared,
    phase: "integration-tooling",
    allowedFiles: declared.allowedFiles.filter(
      (file) => !deliveryPublishedFiles.includes(file),
    ),
  };
};

const coreFiles = [
  ".github/bootstrap-policy.json",
  ".github/workflows/bootstrap.yml",
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const policy = (overrides = {}) => ({
  allowedFiles: coreFiles,
  applicationReady: false,
  maximumChangedFiles: 100,
  phase: "governance",
  schemaVersion: 1,
  ...overrides,
});

const foundationFiles = [
  ...coreFiles.filter((file) => file !== ".github/workflows/bootstrap.yml"),
  ".agents/validation.json",
  ".github/workflows/ci.yml",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "package.json",
  "package-lock.json",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "src/shared/contracts/index.ts",
  "src/shared/settings/contracts.ts",
  "src/features/account/types.ts",
  "src/features/login/types.ts",
  "src/features/recovery/types.ts",
  "src/features/register/types.ts",
  "src/shared/lib/form-values.ts",
  "src/shared/lib/form-values.test.ts",
  "src/shared/api/origin.ts",
  "src/i18n/catalog-data/locales.ts",
  "src/shared/settings/language.ts",
  "src/shared/settings/language.test.ts",
  "tsconfig.json",
];
const foundationPolicy = (overrides = {}) =>
  policy({
    allowedFiles: foundationFiles,
    phase: "foundation",
    ...overrides,
  });
const localizationFiles = [
  "docs/localization.md",
  "docs/localization.fa.md",
  "src/i18n/catalogs.ts",
  "src/i18n/catalog-data/integrity.test.ts",
  "src/i18n/catalog-data/website-types.ts",
  ...["ar", "de", "en", "es", "fa", "fr", "it", "pt", "ru", "tr"].map(
    (code) => `src/i18n/catalog-data/locales/${code}.ts`,
  ),
];
const localizationPolicy = (overrides = {}) =>
  foundationPolicy({
    allowedFiles: [...foundationFiles, ...localizationFiles],
    phase: "localization",
    ...overrides,
  });

test("localization requires every catalog, its type and loader, tests and guidance", () => {
  const complete = [...foundationFiles, ...localizationFiles];
  assert.equal(
    validateBootstrapPolicy(localizationPolicy()).size,
    complete.length,
  );
  for (const file of localizationFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy(
          localizationPolicy({
            allowedFiles: complete.filter((value) => value !== file),
          }),
        ),
      /mandatory/,
    );
});

test("only the localization phase admits its explicit pure source closure", () => {
  assert.throws(() =>
    validateBootstrapPolicy(
      foundationPolicy({
        allowedFiles: [...foundationFiles, ...localizationFiles],
      }),
    ),
  );
  for (const file of [
    "src/app/global-error.tsx",
    "src/i18n/request.ts",
    "src/i18n/client-messages.ts",
    "src/i18n/catalog-data/locales/ja.ts",
    "src/i18n/catalog-data/locales/common.ts",
    "src/i18n/catalog-data/extra.ts",
    "src/shared/settings/server.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        localizationPolicy({
          allowedFiles: [...foundationFiles, ...localizationFiles, file],
        }),
      ),
    );
  assert.throws(() =>
    validateBootstrapPolicy(localizationPolicy({ applicationReady: true })),
  );
});

test("foundation cannot omit either CI policy guard file", () => {
  for (const file of ["scripts/check-ci.mjs", "scripts/check-ci.test.mjs"])
    assert.throws(
      () =>
        validateBootstrapPolicy(
          foundationPolicy({
            allowedFiles: foundationFiles.filter((item) => item !== file),
          }),
        ),
      /mandatory/,
    );
});

const fixture = async (context, declaredPolicy = policy()) => {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "kernel-bootstrap-test-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    assert.ok(path.basename(root).startsWith("kernel-bootstrap-test-"));
    await rm(root, { force: true, recursive: true });
  });
  const put = async (file, content) => {
    const absolute = path.join(root, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  };
  for (const file of declaredPolicy.allowedFiles)
    await put(
      file,
      file.endsWith(".json")
        ? JSON.stringify(file === coreFiles[0] ? declaredPolicy : {})
        : "// synthetic fixture\n",
    );
  return { put, root };
};

test("localization inspects an exact non-runnable snapshot and rejects missing catalogs", async (context) => {
  const { root } = await fixture(context, localizationPolicy());
  await mkdir(path.join(root, "node_modules"));
  await mkdir(path.join(root, "coverage"));
  assert.deepEqual(await inspectBootstrap(root), {
    applicationReady: false,
    files: foundationFiles.length + localizationFiles.length,
    phase: "localization",
    scope:
      "Published contracts, input helpers, API-authoritative settings-language loading and complete local catalogs; Next.js UI, rendering, browser behavior and deployment are not published or validated.",
  });
  await rm(path.join(root, "src/i18n/catalog-data/locales/fa.ts"));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
});

test("accepts only the declared governance phase and immutable 100-file maximum", () => {
  assert.equal(validateBootstrapPolicy(policy()).size, coreFiles.length);
  for (const overrides of [
    { phase: "application" },
    { applicationReady: true },
    { maximumChangedFiles: 101 },
    { schemaVersion: 2 },
    { allowedFiles: [] },
    { allowedFiles: coreFiles.slice(1) },
  ])
    assert.throws(() => validateBootstrapPolicy(policy(overrides)));
});

test("rejects wildcard, escaping, private, duplicate and application import paths", () => {
  for (const file of [
    "src/index.ts",
    "drizzle/0000.sql",
    "collection/auth/index.bru",
    "package.json",
    "package-lock.json",
    "server/data/live.sqlite",
    ".env.local",
    ".agents/settings.local.json",
    "docs/**",
    "../outside.md",
    "/absolute.md",
    "C:/outside.md",
    "docs\\outside.md",
    coreFiles[0],
  ])
    assert.throws(() =>
      validateBootstrapPolicy(policy({ allowedFiles: [...coreFiles, file] })),
    );
});

test("validates an isolated exact snapshot and states that the website is not ready", async (context) => {
  const { root } = await fixture(context);
  await mkdir(path.join(root, ".git"));
  assert.deepEqual(await inspectBootstrap(root), {
    applicationReady: false,
    files: coreFiles.length,
    phase: "governance",
    scope:
      "Published governance files only; website runtime is not published or validated.",
  });
});

test("fails for missing declared files and ambient untracked application files", async (context) => {
  const { put, root } = await fixture(context);
  await rm(path.join(root, coreFiles[1]));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
  await put(coreFiles[1], "name: Bootstrap\n");
  await put("src/index.ts", "throw new Error('must never run');\n");
  await assert.rejects(
    inspectBootstrap(root),
    /Unexpected bootstrap path: src/,
  );
});

test("fails before reading unexpected private files or following links", async (context) => {
  const { put, root } = await fixture(context);
  await put(".env.local", "synthetic-private-fixture\n");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
  await rm(path.join(root, ".env.local"));
  await symlink(
    path.join(root, "scripts"),
    path.join(root, "linked-scripts"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
});

test("rejects invalid JSON and invalid JavaScript without executing it", async (context) => {
  const { put, root } = await fixture(context);
  await put(coreFiles[3], "const = ;\n");
  await assert.rejects(inspectBootstrap(root), /JavaScript syntax is invalid/);
  await put(
    coreFiles[3],
    "throw new Error('syntax check must not execute');\n",
  );
  assert.equal((await inspectBootstrap(root)).applicationReady, false);
  await put(coreFiles[0], "not json");
  await assert.rejects(inspectBootstrap(root), SyntaxError);
});

test("foundation allows its pure source and toolchain, while rejecting runnable website paths", () => {
  assert.equal(
    validateBootstrapPolicy(foundationPolicy()).size,
    foundationFiles.length,
  );
  for (const file of [
    "src/index.ts",
    "src/app/layout.tsx",
    "src/proxy.ts",
    "src/i18n/catalogs.ts",
    "src/features/login/Login.tsx",
    "src/application/auth.ts",
    "src/infrastructure/db/client.ts",
    "src/presentation/http/app.ts",
    "drizzle.config.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        foundationPolicy({ allowedFiles: [...foundationFiles, file] }),
      ),
    );
  assert.throws(
    () =>
      validateBootstrapPolicy(
        foundationPolicy({
          allowedFiles: foundationFiles.filter(
            (file) => file !== "package-lock.json",
          ),
        }),
      ),
    /mandatory/,
  );
});

test("the 100-file limit applies to a PR delta rather than the total published inventory", () => {
  const files = [
    ...foundationFiles,
    ...Array.from({ length: 110 }, (_, index) => `docs/topic-${index}.md`),
  ];
  assert.equal(
    validateBootstrapPolicy(foundationPolicy({ allowedFiles: files })).size,
    files.length,
  );
  assert.throws(() =>
    validateBootstrapPolicy(foundationPolicy({ maximumChangedFiles: 101 })),
  );
});

test("foundation validates its exact source while ignoring only ordinary generated root directories", async (context) => {
  const { root, put } = await fixture(context, foundationPolicy());
  await mkdir(path.join(root, "node_modules"));
  await mkdir(path.join(root, "coverage"));
  await put("node_modules/ignored.json", "not parsed");
  await put("coverage/ignored.json", "not parsed");
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "foundation");
  assert.equal(result.applicationReady, false);
  assert.equal(result.files, foundationFiles.length);
  await put("src/undeclared.ts", "throw new Error('not run');");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});

test("generated output names cannot hide files or links", async (context) => {
  const { root, put } = await fixture(context, foundationPolicy());
  await put("coverage", "not a directory");
  await assert.rejects(inspectBootstrap(root), /ordinary root directory/);
  await rm(path.join(root, "coverage"));
  await symlink(
    path.join(root, "src"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(inspectBootstrap(root), /ordinary root directory/);
});

test("maintained links cannot reference omitted source or private paths", async (context) => {
  const declared = foundationPolicy({
    allowedFiles: [...foundationFiles, "docs/guide.md"],
  });
  const { root, put } = await fixture(context, declared);
  await put("docs/guide.md", "[policy](../.github/bootstrap-policy.json)\n");
  assert.equal((await inspectBootstrap(root)).applicationReady, false);
  for (const link of [
    "../.env.local",
    "../../outside.md",
    "../src/app/layout.tsx",
  ]) {
    await put("docs/guide.md", "[invalid](" + link + ")\n");
    await assert.rejects(
      inspectBootstrap(root),
      /outside the declared snapshot/,
    );
  }
});

const serverBoundaryFiles = [
  "src/shared/api/proxy.ts",
  "src/shared/api/proxy.test.ts",
  "src/shared/security/csp.ts",
  "src/shared/security/csp.test.ts",
  "docs/server-boundary.md",
  "docs/server-boundary.fa.md",
];
const serverBoundaryPolicy = (overrides = {}) =>
  localizationPolicy({
    allowedFiles: [
      ...foundationFiles,
      ...localizationFiles,
      ...serverBoundaryFiles,
    ],
    phase: "server-boundary",
    ...overrides,
  });
test("server-boundary requires its complete source, owner tests and bilingual guidance", () => {
  const complete = [
    ...foundationFiles,
    ...localizationFiles,
    ...serverBoundaryFiles,
  ];
  assert.equal(
    validateBootstrapPolicy(serverBoundaryPolicy()).size,
    complete.length,
  );
  for (const file of [...localizationFiles, ...serverBoundaryFiles])
    assert.throws(
      () =>
        validateBootstrapPolicy(
          serverBoundaryPolicy({
            allowedFiles: complete.filter((value) => value !== file),
          }),
        ),
      /mandatory/,
    );
  assert.throws(() =>
    validateBootstrapPolicy(localizationPolicy({ allowedFiles: complete })),
  );
  for (const file of [
    "src/proxy.ts",
    "src/shared/security/nonce.ts",
    "src/app/layout.tsx",
    "src/shared/api/client.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        serverBoundaryPolicy({ allowedFiles: [...complete, file] }),
      ),
    );
  assert.throws(() =>
    validateBootstrapPolicy(serverBoundaryPolicy({ applicationReady: true })),
  );
});
test("server-boundary inspects its exact non-runnable snapshot", async (context) => {
  const { root } = await fixture(context, serverBoundaryPolicy());
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "server-boundary");
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /pure CSP helpers/);
  await rm(path.join(root, "src/shared/api/proxy.test.ts"));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
});

test("integration tooling retains complete forms, support, owner tests and fonts while remaining non-runnable", async (context) => {
  const declared = await integrationPolicy();
  assert.equal(declared.phase, "integration-tooling");
  assert.equal(declared.applicationReady, false);
  assert.equal(validateBootstrapPolicy(declared).size, 254);
  const older = new Set(serverBoundaryPolicy().allowedFiles);
  const added = declared.allowedFiles.filter(
    (file) =>
      !older.has(file) &&
      (file.startsWith("src/") ||
        file.startsWith("public/") ||
        file.startsWith("font-source/") ||
        file === "performance-budget.json" ||
        file === "scripts/subset-website-fonts.py" ||
        file.startsWith("docs/client-document.") ||
        file.startsWith("docs/fonts.") ||
        file.startsWith("docs/client-ui.") ||
        file.startsWith("docs/session.") ||
        file.startsWith("docs/forms.")),
  );
  assert.equal(added.length, 94);
  for (const file of added)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: declared.allowedFiles.filter((entry) => entry !== file),
        }),
      /mandatory/,
    );
  for (const file of [
    "src/app/layout.tsx",
    "src/app/providers/unpublished.tsx",
    "src/components/ui/dialog.tsx",
    "src/test/unlisted.ts",
    "src/proxy.ts",
    "src/shared/settings/server.ts",
    "src/shared/security/nonce.ts",
    "src/i18n/request.ts",
    "src/website/home/Home.tsx",
    "deploy/docker/Dockerfile",
  ]) {
    assert.throws(() =>
      validateBootstrapPolicy({
        ...declared,
        allowedFiles: [...declared.allowedFiles, file],
      }),
    );
  }
  assert.throws(() =>
    validateBootstrapPolicy({ ...declared, applicationReady: true }),
  );
  assert.throws(() =>
    validateBootstrapPolicy({ ...declared, phase: "server-boundary" }),
  );
  const { root } = await fixture(context, declared);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "integration-tooling");
  assert.equal(result.applicationReady, false);
});

test("integration tooling requires its executable policy, optional hooks, indexes and bilingual architecture records", async () => {
  const declared = await integrationPolicy();
  for (const file of [
    ".agents/README.md",
    ".agents/settings.json",
    ".agents/navigation.json",
    ".agents/evaluation/cases.json",
    ".agents/hooks/block-dangerous.mjs",
    "scripts/check-guidance.mjs",
    "scripts/guidance.test.mjs",
    "scripts/ai-hooks.portable.test.mjs",
    "DESIGN.md",
    "DESIGN.fa.md",
    "docs/adr/README.md",
    "docs/adr/README.fa.md",
  ]) {
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: declared.allowedFiles.filter((entry) => entry !== file),
        }),
      /mandatory/,
    );
  }
});

test("integration tooling closes over every helper, owner test, guide pair and maintained support file", async () => {
  const declared = await integrationPolicy();
  const toolingFiles = [
    "scripts/api-repository.mjs",
    "scripts/api-repository.test.mjs",
    "scripts/check-bundle-website.mjs",
    "scripts/visual-environment.mjs",
    "scripts/visual-environment.test.mjs",
    "scripts/website-performance-environment.mjs",
    "scripts/website-performance.test.mjs",
    ...[
      "accessibility",
      "test-reliability",
      "testing",
      "validation",
      "visual-regression",
      "website-csp",
      "website-performance",
    ].flatMap((name) => [`docs/${name}.md`, `docs/${name}.fa.md`]),
    "AGENTS.md",
    "README.md",
    "README.fa.md",
    "CONTRIBUTING.md",
    "CONTRIBUTING.fa.md",
    "docs/bootstrap.md",
    "docs/bootstrap.fa.md",
    ".github/workflows/sonar.yml",
    "scripts/run-audit.mjs",
    "scripts/run-audit.test.mjs",
  ];
  for (const file of toolingFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: declared.allowedFiles.filter((entry) => entry !== file),
        }),
      /mandatory/,
      file,
    );
  for (const file of [
    "scripts/test-website-api.mjs",
    "scripts/test-website-server.mjs",
    "scripts/run-visual.mjs",
    "scripts/run-website-performance.mjs",
    "scripts/prepare-standalone.mjs",
    "playwright.website.config.ts",
    "playwright.visual.config.ts",
    "knip.json",
    "vitest.tooling.config.ts",
    "e2e/visual/baselines/win32/metadata.json",
    ".github/workflows/browser.yml",
    "docs/unlisted.md",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: [...declared.allowedFiles, file],
        }),
      /closed published inventory/,
      file,
    );
  assert.throws(
    () => validateBootstrapPolicy({ ...declared, phase: "guidance" }),
    /declared phase/,
  );
});

test("integration tooling inspects exact owned files and rejects missing, private, linked or activating additions", async (context) => {
  const declared = await integrationPolicy();
  const { root, put } = await fixture(context, declared);
  const result = await inspectBootstrap(root);
  assert.equal(result.files, 254);
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /owned synthetic tests/);
  for (const file of [
    "scripts/test-website-api.mjs",
    "src/app/page.tsx",
    ".env.local",
  ]) {
    await put(
      file,
      "synthetic unexpected input; must not be loaded or executed\n",
    );
    await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
    await rm(path.join(root, file));
  }
  await rm(path.join(root, "scripts/api-repository.test.mjs"));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
  await put("scripts/api-repository.test.mjs", "// synthetic fixture\n");
  await symlink(
    path.join(root, "docs"),
    path.join(root, "linked-docs"),
    "junction",
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
});

test("delivery tooling closes over exactly49 additions to the historical254-file integration phase", async () => {
  const declared = await readPublicationPolicy();
  const historical = await integrationPolicy();
  assert.equal(declared.phase, "delivery-tooling");
  assert.equal(declared.applicationReady, false);
  assert.equal(validateBootstrapPolicy(declared).size, 303);
  assert.equal(validateBootstrapPolicy(historical).size, 254);
  assert.equal(deliveryPublishedFiles.length, 49);
  assert.deepEqual(
    declared.allowedFiles
      .filter((file) => !historical.allowedFiles.includes(file))
      .sort(),
    [...deliveryPublishedFiles].sort(),
  );
  for (const file of deliveryPublishedFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: declared.allowedFiles.filter((entry) => entry !== file),
        }),
      /mandatory/,
      file,
    );
  for (const overrides of [
    { applicationReady: true },
    { maximumChangedFiles: 101 },
    { phase: "application" },
    { phase: "integration-tooling" },
  ])
    assert.throws(() => validateBootstrapPolicy({ ...declared, ...overrides }));
});

test("delivery tooling admits only its four exact public examples and rejects runtime, private or foreign paths", async () => {
  const declared = await readPublicationPolicy();
  assert.deepEqual(
    declared.allowedFiles
      .filter((file) => /(?:^|\/)(?:\.env|[^/]+\.env)(?:\.|$)/.test(file))
      .sort(),
    [
      ".env.example",
      "deploy/docker/.env.example",
      "deploy/native/hosts.env.example",
      "deploy/native/website.env.example",
    ],
  );
  for (const file of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.example/child",
    "docs/.env.example",
    "config/hosts.env.example",
    "deploy/docker/.env",
    "deploy/native/website.env",
    "deploy/native/secret.env.example",
    "deploy/native/WEBSITE.env.example",
    "deploy/docker/id_rsa",
    "deploy/docker/key.pem",
    "deploy",
    "deploy/unlisted.conf",
    "deploy/docker/smoke.mjs",
    "scripts/start-website.mjs",
    "scripts/start-website.test.mjs",
    "scripts/launch-delivery.mjs",
    "scripts/foreign.env.example",
    "playwright.smoke.config.ts",
    "playwright.staging.config.ts",
    "vitest.tooling.config.ts",
    "e2e/operations/smoke.spec.ts",
    "e2e/operations/staging.spec.ts",
    ".github/workflows/codeql.yml",
    ".github/workflows/dast.yml",
    ".github/workflows/deployment-smoke.yml",
    ".github/workflows/package-release.yml",
    ".github/workflows/release.yml",
    ".github/workflows/staging.yml",
    "src/app/page.tsx",
    "src/app/layout.tsx",
    "src/proxy.ts",
    "server/data/live.db",
    "docs/foreign.md",
    ".agents/settings.local.json",
    "docs/invalid\0path.md",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...declared,
          allowedFiles: [...declared.allowedFiles, file],
        }),
      undefined,
      file,
    );
  const foreign = {
    ...declared,
    allowedFiles: [...declared.allowedFiles, "docs/foreign.md"],
  };
  assert.throws(
    () => validateBootstrapPolicy(foreign),
    /closed published inventory/,
  );
});

test("delivery tooling inspects303 files without activation and rejects missing, private or linked examples", async (context) => {
  const declared = await readPublicationPolicy();
  const { root, put } = await fixture(context, declared);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "delivery-tooling");
  assert.equal(result.files, 303);
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /readiness guard refuses/);
  for (const file of [
    ".env.local",
    "deploy/native/website.env",
    "deploy/docker/smoke.mjs",
  ]) {
    await put(file, "synthetic unexpected input; never load or execute\n");
    await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
    await rm(path.join(root, file));
  }
  await rm(path.join(root, ".env.example"));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
  await symlink(
    path.join(root, "docs"),
    path.join(root, ".env.example"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
});
