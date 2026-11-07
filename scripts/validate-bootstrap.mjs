import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const comparePublicationPaths = (left, right) => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

export async function completePublicationWork(operations) {
  const results = await Promise.allSettled(operations);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      failures.map((failure) => failure.message).join("\n"),
    );
  return results.map((result) => result.value);
}

const reviewedAdditions = {
  foundation: [
    ".agents/README.md",
    ".agents/navigation.json",
    ".agents/rules/api-collection.md",
    ".agents/rules/branches.md",
    ".agents/rules/code-quality.md",
    ".agents/rules/code-review.md",
    ".agents/rules/commits.md",
    ".agents/rules/git.md",
    ".agents/rules/guidance.md",
    ".agents/rules/imports.md",
    ".agents/rules/issues.md",
    ".agents/rules/localization.md",
    ".agents/rules/ordering.md",
    ".agents/rules/pull-requests.md",
    ".agents/rules/safety.md",
    ".agents/rules/testing.md",
    ".agents/rules/typescript.md",
    ".agents/rules/website.md",
    ".agents/settings.json",
    ".agents/skills/commit/SKILL.md",
    ".agents/skills/create-issue/SKILL.md",
    ".agents/skills/create-pr/SKILL.md",
    ".agents/skills/review-pr/SKILL.md",
    ".agents/skills/start-issue/SKILL.md",
    ".agents/skills/validate-change/SKILL.md",
    ".agents/validation.json",
    ".coderabbit.yaml",
    ".gitattributes",
    ".github/CODEOWNERS",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/bootstrap-policy.json",
    ".github/dependabot.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
    ".gitignore",
    ".nvmrc",
    ".prettierignore",
    ".prettierrc.json",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "README.md",
    "SECURITY.md",
    "docs/bootstrap.md",
    "docs/branch-protection.md",
    "docs/fonts.md",
    "docs/localization.md",
    "docs/reviews.md",
    "docs/sonarqube.md",
    "docs/source-navigation.md",
    "docs/test-reliability.md",
    "docs/testing.md",
    "docs/validation.md",
    "eslint.config.mjs",
    "font-source/requirements.txt",
    "font-source/vazirmatn-variable.woff2",
    "package-lock.json",
    "package.json",
    "performance-budget.json",
    "public/fonts/OFL.txt",
    "public/fonts/vazirmatn-arabic.woff2",
    "public/fonts/vazirmatn-extended.woff2",
    "public/fonts/vazirmatn-latin.woff2",
    "scripts/check-boundaries.mjs",
    "scripts/check-boundaries.test.mjs",
    "scripts/check-ci.mjs",
    "scripts/check-ci.test.mjs",
    "scripts/check-guidance.mjs",
    "scripts/check-guidance.test.mjs",
    "scripts/ci-evidence.mjs",
    "scripts/ci-evidence.test.mjs",
    "scripts/run-actionlint.mjs",
    "scripts/run-actionlint.test.mjs",
    "scripts/run-audit.mjs",
    "scripts/run-audit.test.mjs",
    "scripts/subset-website-fonts.py",
    "scripts/validate-bootstrap.mjs",
    "scripts/validate-bootstrap.test.mjs",
    "scripts/validate.mjs",
    "scripts/validate.test.mjs",
    "scripts/validation.integration.test.mjs",
    "sonar-project.properties",
    "src/i18n/catalog-data/integrity.test.ts",
    "src/i18n/catalog-data/locales.ts",
    "src/i18n/catalog-data/locales/ar.json",
    "src/i18n/catalog-data/locales/de.json",
    "src/i18n/catalog-data/locales/en.json",
    "src/i18n/catalog-data/locales/es.json",
    "src/i18n/catalog-data/locales/fa.json",
    "src/i18n/catalog-data/locales/fr.json",
    "src/i18n/catalog-data/locales/it.json",
    "src/i18n/catalog-data/locales/pt.json",
    "src/i18n/catalog-data/locales/ru.json",
    "src/i18n/catalog-data/locales/tr.json",
    "src/i18n/catalog-data/website-types.ts",
    "src/i18n/catalogs.test.ts",
    "src/i18n/catalogs.ts",
    "src/i18n/client-messages.test.ts",
    "src/i18n/client-messages.ts",
    "src/shared/api/client.test.ts",
    "src/shared/api/client.ts",
    "src/shared/api/origin.ts",
    "src/shared/contracts/index.ts",
    "src/shared/fonts/manifest.json",
    "src/shared/fonts/preloads.test.ts",
    "src/shared/fonts/preloads.ts",
    "src/shared/fonts/vazirmatn.css",
    "src/shared/settings/contracts.ts",
    "src/shared/settings/language.test.ts",
    "src/shared/settings/language.ts",
    "src/test/setup.ts",
    "tsconfig.json",
    "vitest.config.ts",
  ],
  "client-foundation": [
    ".agents/skills/design-ui/SKILL.md",
    ".claude/skills/design-ui/SKILL.md",
    "DESIGN.md",
    "components.json",
    "docs/README.md",
    "docs/accessibility.md",
    "docs/architecture.md",
    "docs/authentication-review.md",
    "docs/client-document.md",
    "docs/client-ui.md",
    "docs/forms.md",
    "docs/session.md",
    "scripts/dependency-toolchain.test.mjs",
    "src/features/account/api.test.ts",
    "src/features/account/api.ts",
    "src/features/account/types.ts",
    "src/features/auth/login/api.test.ts",
    "src/features/auth/login/api.ts",
    "src/features/auth/login/types.ts",
    "src/features/auth/recovery/api.test.ts",
    "src/features/auth/recovery/api.ts",
    "src/features/auth/recovery/types.ts",
    "src/features/auth/register/api.test.ts",
    "src/features/auth/register/api.ts",
    "src/features/auth/register/types.ts",
    "src/features/auth/session/SessionProvider.test.tsx",
    "src/features/auth/session/SessionProvider.tsx",
    "src/features/auth/session/api.test.ts",
    "src/features/auth/session/api.ts",
    "src/shared/api/proxy.test.ts",
    "src/shared/api/proxy.ts",
    "src/shared/hooks/use-cooldown.test.ts",
    "src/shared/hooks/use-cooldown.ts",
    "src/shared/hooks/use-operation-scope.test.ts",
    "src/shared/hooks/use-operation-scope.ts",
    "src/shared/lib/cn.test.ts",
    "src/shared/lib/cn.ts",
    "src/shared/lib/form-values.test.ts",
    "src/shared/lib/form-values.ts",
    "src/shared/navigation/document.test.ts",
    "src/shared/navigation/document.ts",
    "src/shared/ui/Feedback.test.tsx",
    "src/shared/ui/Feedback.tsx",
    "src/shared/ui/FormField.test.tsx",
    "src/shared/ui/FormField.tsx",
    "src/shared/ui/ThemeToggle.test.tsx",
    "src/shared/ui/ThemeToggle.tsx",
    "src/shared/ui/alert.test.tsx",
    "src/shared/ui/alert.tsx",
    "src/shared/ui/button.test.tsx",
    "src/shared/ui/button.tsx",
    "src/shared/ui/card.test.tsx",
    "src/shared/ui/card.tsx",
    "src/shared/ui/input-label.integration.test.tsx",
    "src/shared/ui/input.tsx",
    "src/shared/ui/label.tsx",
    "src/test/api-requests.ts",
    "src/test/feature-session.tsx",
    "src/test/intl.ts",
  ],
  features: [
    ".agents/evaluation/cases.json",
    ".agents/evaluation/run-template.json",
    ".agents/hooks/block-dangerous.mjs",
    ".agents/hooks/block-dangerous.sh",
    ".agents/hooks/post-edit-format.sh",
    ".agents/hooks/quality-gate.sh",
    "CLAUDE.md",
    "docs/ai-code-understanding.md",
    "docs/change-workflow.md",
    "docs/comprehension-evaluation.md",
    "docs/seo.md",
    "docs/website-csp.md",
    "docs/website-performance.md",
    "scripts/block-dangerous-shell.test.mjs",
    "scripts/block-dangerous.test.mjs",
    "scripts/hook.test-support.mjs",
    "scripts/post-edit-format.test.mjs",
    "scripts/quality-gate.test.mjs",
    "src/features/account/Account.test.tsx",
    "src/features/account/Account.tsx",
    "src/features/account/components/account-section/AccountSection.tsx",
    "src/features/account/components/email-form/EmailForm.test.tsx",
    "src/features/account/components/email-form/EmailForm.tsx",
    "src/features/account/components/password-form/PasswordForm.test.tsx",
    "src/features/account/components/password-form/PasswordForm.tsx",
    "src/features/account/components/profile-form/ProfileForm.test.tsx",
    "src/features/account/components/profile-form/ProfileForm.tsx",
    "src/features/account/components/username-form/UsernameForm.test.tsx",
    "src/features/account/components/username-form/UsernameForm.tsx",
    "src/features/account/index.ts",
    "src/features/auth/OtpForm.tsx",
    "src/features/auth/login/Login.test.tsx",
    "src/features/auth/login/Login.tsx",
    "src/features/auth/login/index.ts",
    "src/features/auth/recovery/Recovery.test.tsx",
    "src/features/auth/recovery/Recovery.tsx",
    "src/features/auth/recovery/index.ts",
    "src/features/auth/register/Register.test.tsx",
    "src/features/auth/register/Register.tsx",
    "src/features/auth/register/index.ts",
    "src/features/home/Reveal.test.ts",
    "src/features/home/Reveal.tsx",
    "src/shared/performance/WebVitals.test.ts",
    "src/shared/performance/WebVitals.tsx",
    "src/shared/performance/web-vitals.test.ts",
    "src/shared/performance/web-vitals.ts",
    "src/shared/security/csp.test.ts",
    "src/shared/security/csp.ts",
    "src/shared/seo/config.test.ts",
    "src/shared/seo/config.ts",
    "src/shared/seo/metadata.test.ts",
    "src/shared/seo/metadata.ts",
    "src/shared/seo/structured-data.test.ts",
    "src/shared/seo/structured-data.ts",
  ],
  "runners-foundation": [
    ".dockerignore",
    ".env.example",
    "deploy/docker/Dockerfile",
    "deploy/docker/README.md",
    "deploy/docker/compose.env.example",
    "deploy/docker/compose.yaml",
    "deploy/docker/nginx.conf.template",
    "deploy/docker/validate-gateway-env.sh",
    "deploy/docker/website-entrypoint.sh",
    "deploy/native/README.md",
    "deploy/native/nginx.env.example",
    "deploy/native/nginx/acme-bootstrap.conf.template",
    "deploy/native/nginx/kernel-website.conf.template",
    "deploy/native/systemd/kernel-website.service",
    "deploy/native/website.env.example",
    "docs/api-fixture.md",
    "docs/deployment.md",
    "docs/runner-foundation.md",
    "scripts/analyze-website-performance.mjs",
    "scripts/analyze-website-performance.test.mjs",
    "scripts/api-fixture-test-support.mjs",
    "scripts/deployment.test-support.mjs",
    "scripts/healthcheck.mjs",
    "scripts/healthcheck.test.mjs",
    "scripts/package-release.mjs",
    "scripts/package-release.test.mjs",
    "scripts/prepare-standalone.mjs",
    "scripts/prepare-standalone.test.mjs",
    "scripts/release-files.mjs",
    "scripts/release-files.test.mjs",
    "scripts/render-deployment.mjs",
    "scripts/render-deployment.test.mjs",
    "scripts/runner-inputs.mjs",
    "scripts/runner-inputs.test.mjs",
    "scripts/runner-process.mjs",
    "scripts/runner-process.test.mjs",
    "scripts/runner.test-support.mjs",
    "scripts/start-website.mjs",
    "scripts/start-website.test.mjs",
    "scripts/test-website-api.mjs",
    "scripts/test-website-api.test.mjs",
    "scripts/test-website-server.mjs",
    "scripts/test-website-server.test.mjs",
    "scripts/validate-deployment-env.mjs",
    "scripts/validate-deployment-env.test.mjs",
    "scripts/validate-gateway-env.test.mjs",
    "scripts/website-api-fixture.mjs",
    "scripts/website-api-fixture.test.mjs",
    "scripts/website-entrypoint.test.mjs",
    "scripts/website-performance-environment.mjs",
    "scripts/website-performance-environment.test.mjs",
  ],
  "browser-foundation": [
    "docs/browser-foundation.md",
    "docs/visual-regression.md",
    "e2e/operations/smoke.spec.ts",
    "e2e/operations/staging.spec.ts",
    "e2e/visual/baselines/win32/metadata.json",
    "e2e/visual/baselines/win32/website-home-en-dark.png",
    "e2e/visual/baselines/win32/website-home-fa-dark.png",
    "e2e/visual/baselines/win32/website-login-en-light.png",
    "e2e/visual/baselines/win32/website-register-fa-light.png",
    "e2e/visual/readiness.ts",
    "e2e/visual/website.spec.ts",
    "e2e/website/accessibility.spec.ts",
    "e2e/website/client-boundaries.spec.ts",
    "e2e/website/csp.spec.ts",
    "e2e/website/font-performance.spec.ts",
    "e2e/website/helpers.ts",
    "e2e/website/performance.spec.ts",
    "e2e/website/seo.spec.ts",
    "e2e/website/session-isolation.spec.ts",
    "e2e/website/website.spec.ts",
    "playwright.smoke.config.ts",
    "playwright.staging.config.ts",
    "playwright.visual.config.ts",
    "playwright.website.config.ts",
    "scripts/application-checks.mjs",
    "scripts/application-checks.test.mjs",
    "scripts/browser-inputs.mjs",
    "scripts/browser-inputs.test.mjs",
    "scripts/check-bundle-website.mjs",
    "scripts/check-bundle-website.test.mjs",
    "scripts/deployment.integration.test.mjs",
    "scripts/playwright-config.mjs",
    "scripts/playwright-config.test.mjs",
    "scripts/run-visual.mjs",
    "scripts/run-visual.test.mjs",
    "scripts/test-csp-report-only.mjs",
    "scripts/test-csp-report-only.test.mjs",
    "scripts/validate-workflow-targets.mjs",
    "scripts/validate-workflow-targets.test.mjs",
    "scripts/visual-environment.mjs",
    "scripts/visual-environment.test.mjs",
    "tsconfig.tooling.json",
  ],
  application: [
    "docs/application.md",
    "docs/development.md",
    "docs/server-boundary.md",
    "docs/threat-model.md",
    "knip.json",
    "next-env.d.ts",
    "next.config.ts",
    "postcss.config.mjs",
    "scripts/verification-build.mjs",
    "scripts/verification-build.test.mjs",
    "src/app/(auth)/forgot-password/page.tsx",
    "src/app/(auth)/layout.tsx",
    "src/app/(auth)/login/page.tsx",
    "src/app/(auth)/register/page.tsx",
    "src/app/[...rest]/page.test.tsx",
    "src/app/[...rest]/page.tsx",
    "src/app/_components/Footer.tsx",
    "src/app/_components/Header.tsx",
    "src/app/_components/HeaderAccountLink.test.tsx",
    "src/app/_components/HeaderAccountLink.tsx",
    "src/app/account/page.tsx",
    "src/app/api/[...path]/route.ts",
    "src/app/error.test.tsx",
    "src/app/error.tsx",
    "src/app/global-error.test.tsx",
    "src/app/global-error.tsx",
    "src/app/globals.css",
    "src/app/icon.svg",
    "src/app/layout.tsx",
    "src/app/not-found.test.tsx",
    "src/app/not-found.tsx",
    "src/app/page.tsx",
    "src/app/providers/Providers.test.ts",
    "src/app/providers/Providers.tsx",
    "src/app/robots.ts",
    "src/app/runtime-composition.test.tsx",
    "src/app/sitemap.ts",
    "src/app/social-image/route.tsx",
    "src/features/auth/AuthLayout.tsx",
    "src/features/home/Home.tsx",
    "src/i18n/request.ts",
    "src/proxy.test.ts",
    "src/proxy.ts",
    "src/shared/runtime-adapters.test.ts",
    "src/shared/security/nonce.ts",
    "src/shared/settings/server.ts",
  ],
  operations: [
    ".github/workflows/dast.yml",
    ".github/workflows/deployment-smoke.yml",
    ".github/workflows/package-release.yml",
    ".github/workflows/release.yml",
    ".github/workflows/staging.yml",
    ".release-please-manifest.json",
    "CHANGELOG.md",
    "docs/release-operations.md",
    "docs/releasing.md",
    "docs/staging.md",
    "docs/troubleshooting.md",
    "release-please-config.json",
    "scripts/docker-smoke-cleanup.mjs",
    "scripts/docker-smoke-cleanup.test.mjs",
    "scripts/operations-checks.mjs",
    "scripts/operations-checks.test.mjs",
    "scripts/run-docker-smoke.mjs",
    "scripts/run-docker-smoke.test.mjs",
    "scripts/run-website-performance.mjs",
    "scripts/run-website-performance.test.mjs",
  ],
};
const cumulative = new Set();
export const publicationInventories = Object.freeze(
  Object.fromEntries(
    Object.entries(reviewedAdditions).map(([phase, files]) => {
      files.forEach((file) => cumulative.add(file));
      return [
        phase,
        Object.freeze([...cumulative].sort(comparePublicationPaths)),
      ];
    }),
  ),
);
export const publicationReadiness = Object.freeze({
  foundation: false,
  "client-foundation": false,
  features: false,
  "runners-foundation": false,
  "browser-foundation": false,
  application: true,
  operations: true,
});
export const publicationFiles = Object.freeze([
  ...new Set(Object.values(publicationInventories).flat()),
]);
export function validateBootstrapPolicy(policy) {
  assert.equal(policy?.schemaVersion, 1);
  assert.ok(
    Object.hasOwn(publicationInventories, policy.phase),
    "Only a reviewed phase can be selected.",
  );
  assert.equal(
    policy.applicationReady,
    publicationReadiness[policy.phase],
    "Readiness must match the reviewed phase.",
  );
  assert.deepEqual(Object.keys(policy).sort(comparePublicationPaths), [
    "allowedFiles",
    "applicationReady",
    "phase",
    "schemaVersion",
  ]);
  assert.ok(Array.isArray(policy.allowedFiles));
  assert.equal(
    new Set(policy.allowedFiles).size,
    policy.allowedFiles.length,
    "Duplicate publication path.",
  );
  assert.deepEqual(
    [...policy.allowedFiles].sort(comparePublicationPaths),
    [...publicationInventories[policy.phase]].sort(comparePublicationPaths),
    "The reviewed publication inventory must match exactly.",
  );
  return new Set(policy.allowedFiles);
}
async function inspectAncestors(cursor, parts, index = 0) {
  const entry = await lstat(cursor);
  assert.equal(
    entry.isSymbolicLink(),
    false,
    "Publication paths cannot contain symbolic links.",
  );
  return index === parts.length
    ? entry
    : inspectAncestors(path.join(cursor, parts[index]), parts, index + 1);
}

export async function ordinaryPath(filename, directory = false) {
  const absolute = path.resolve(filename);
  const origin = path.parse(absolute).root;
  const parts = absolute.slice(origin.length).split(path.sep).filter(Boolean);
  const entry = await inspectAncestors(origin, parts);
  assert.ok(
    directory ? entry.isDirectory() : entry.isFile(),
    "Unexpected publication path type.",
  );
  return absolute;
}

async function publication(root) {
  const directory = await ordinaryPath(root, true);
  // The one fixed public marker is the only content read before names are checked.
  const marker = await ordinaryPath(
    path.join(directory, ".github/bootstrap-policy.json"),
  );
  const policy = JSON.parse(await readFile(marker, "utf8"));
  return { directory, policy, files: validateBootstrapPolicy(policy) };
}
export async function getPublicationFiles(root = repository) {
  return [...(await publication(root)).files];
}
export async function readPublishedFile(root, filename) {
  const declared = await publication(root);
  assert.ok(
    declared.files.has(filename),
    "Unpublished file reference: " + filename,
  );
  return readFile(
    await ordinaryPath(path.join(declared.directory, filename)),
    "utf8",
  );
}
async function inspectDirectory(root, relative, files, ignored, found) {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  await completePublicationWork(
    entries.map(async (entry) => {
      const name = relative ? relative + "/" + entry.name : entry.name;
      assert.equal(
        entry.isSymbolicLink(),
        false,
        "Publication paths cannot contain symbolic links.",
      );
      if (!relative && ignored.has(name)) {
        assert.ok(
          entry.isDirectory(),
          "Ignored output must be an ordinary directory.",
        );
        return;
      }
      if (entry.isDirectory()) {
        assert.ok(
          [...files].some((file) => file.startsWith(name + "/")),
          "Unexpected publication directory: " + name,
        );
        return inspectDirectory(root, name, files, ignored, found);
      } else {
        assert.ok(
          entry.isFile() && files.has(name),
          "Unexpected publication file: " + name,
        );
        found.add(name);
      }
    }),
  );
}
export async function inspectBootstrap(root = repository) {
  const { directory, policy, files } = await publication(root);
  const ignored = new Set([
    ".git",
    "node_modules",
    "coverage",
    ".next",
    "playwright-report",
    "test-results",
    ...(policy.phase === "operations" ? ["dist", ".lighthouseci"] : []),
  ]);
  const found = new Set();
  await inspectDirectory(directory, "", files, ignored, found);
  assert.deepEqual(
    [...found].sort(comparePublicationPaths),
    [...files].sort(comparePublicationPaths),
    "Missing declared publication files.",
  );
  await completePublicationWork(
    [...files]
      .filter((filename) => filename.endsWith(".json"))
      .map(async (filename) =>
        JSON.parse(await readPublishedFile(directory, filename)),
      ),
  );
  for (const filename of files)
    if (filename.endsWith(".mjs")) {
      const result = spawnSync(
        process.execPath,
        ["--check", path.join(directory, filename)],
        { cwd: directory, env: {}, encoding: "utf8", windowsHide: true },
      );
      assert.equal(
        result.error,
        undefined,
        "JavaScript syntax verification could not run.",
      );
      assert.equal(
        result.status,
        0,
        "Invalid JavaScript syntax: " + filename + "\n" + result.stderr,
      );
    }
  return {
    phase: policy.phase,
    applicationReady: policy.applicationReady,
    files: found.size,
  };
}
if (import.meta.main) {
  const result = await inspectBootstrap();
  console.log(
    "Exact " +
      result.phase +
      " publication passed; application readiness is " +
      result.applicationReady +
      ".",
  );
}
