import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const policyPath = ".github/bootstrap-policy.json";
const coreFiles = [
  policyPath,
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const foundationFiles = [
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
const foundationSource = new Set([
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
]);
const localizationFiles = [
  "docs/localization.md",
  "docs/localization.fa.md",
  "src/i18n/catalogs.ts",
  "src/i18n/catalog-data/integrity.test.ts",
  "src/i18n/catalog-data/website-types.ts",
  "src/i18n/catalog-data/locales/ar.ts",
  "src/i18n/catalog-data/locales/de.ts",
  "src/i18n/catalog-data/locales/en.ts",
  "src/i18n/catalog-data/locales/es.ts",
  "src/i18n/catalog-data/locales/fa.ts",
  "src/i18n/catalog-data/locales/fr.ts",
  "src/i18n/catalog-data/locales/it.ts",
  "src/i18n/catalog-data/locales/pt.ts",
  "src/i18n/catalog-data/locales/ru.ts",
  "src/i18n/catalog-data/locales/tr.ts",
];
const localizationSource = new Set(
  localizationFiles.filter((file) => file.startsWith("src/")),
);
const serverBoundaryFiles = [
  "src/shared/api/proxy.ts",
  "src/shared/api/proxy.test.ts",
  "src/shared/security/csp.ts",
  "src/shared/security/csp.test.ts",
  "docs/server-boundary.md",
  "docs/server-boundary.fa.md",
];
const serverBoundarySource = new Set(
  serverBoundaryFiles.filter((file) => file.startsWith("src/")),
);
const clientDocumentFiles = [
  "src/shared/api/client.ts",
  "src/shared/api/client.test.ts",
  "src/features/auth/api.ts",
  "src/features/account/api.ts",
  "src/features/login/api.ts",
  "src/features/register/api.ts",
  "src/features/recovery/api.ts",
  "src/features/api.test.ts",
  "src/shared/seo/config.ts",
  "src/shared/seo/config.test.ts",
  "src/shared/seo/metadata.ts",
  "src/shared/seo/metadata.test.ts",
  "src/shared/seo/structured-data.ts",
  "src/shared/seo/structured-data.test.ts",
  "src/shared/performance/web-vitals.ts",
  "src/shared/performance/web-vitals.test.ts",
  "src/shared/fonts/preloads.ts",
  "src/shared/fonts/preloads.test.ts",
  "src/shared/fonts/manifest.json",
  "src/shared/fonts/vazirmatn.css",
  "src/i18n/client-messages.ts",
  "src/i18n/client-messages.test.ts",
  "src/i18n/catalogs.test.ts",
  "src/lib/utils.ts",
  "src/lib/utils.test.ts",
  "public/fonts/vazirmatn-latin.woff2",
  "public/fonts/vazirmatn-arabic.woff2",
  "public/fonts/vazirmatn-extended.woff2",
  "public/fonts/OFL.txt",
  "font-source/vazirmatn-variable.woff2",
  "font-source/requirements.txt",
  "scripts/subset-website-fonts.py",
  "performance-budget.json",
  "docs/client-document.md",
  "docs/client-document.fa.md",
  "docs/fonts.md",
  "docs/fonts.fa.md",
];
const clientDocumentSource = new Set(
  clientDocumentFiles.filter((file) => file.startsWith("src/")),
);
const clientUiFiles = [
  "src/app/providers/Providers.test.ts",
  "src/app/providers/Providers.tsx",
  "src/components/ui/alert.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/primitives.test.tsx",
  "src/features/auth/SessionProvider.test.tsx",
  "src/features/auth/SessionProvider.tsx",
  "src/shared/hooks/use-cooldown.test.ts",
  "src/shared/hooks/use-cooldown.ts",
  "src/shared/performance/WebVitals.test.ts",
  "src/shared/performance/WebVitals.tsx",
  "src/shared/ui/Feedback.test.tsx",
  "src/shared/ui/Feedback.tsx",
  "src/shared/ui/FormField.test.tsx",
  "src/shared/ui/FormField.tsx",
  "src/test/intl.ts",
  "src/test/setup.ts",
  "src/website/home/Reveal.test.ts",
  "src/website/home/Reveal.tsx",
  "src/website/shared/Preferences.test.tsx",
  "src/website/shared/Preferences.tsx",
  "docs/client-ui.md",
  "docs/client-ui.fa.md",
  "docs/session.md",
  "docs/session.fa.md",
];
const clientUiSource = new Set(
  clientUiFiles.filter((file) => file.startsWith("src/")),
);
const featureUiFiles = [
  "docs/forms.fa.md",
  "docs/forms.md",
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
  "src/features/login/Login.test.tsx",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/recovery/Recovery.test.tsx",
  "src/features/recovery/Recovery.tsx",
  "src/features/recovery/index.ts",
  "src/features/register/Register.test.tsx",
  "src/features/register/Register.tsx",
  "src/features/register/index.ts",
  "src/shared/hooks/use-operation-scope.test.ts",
  "src/shared/hooks/use-operation-scope.ts",
  "src/shared/navigation/document.test.ts",
  "src/shared/navigation/document.ts",
  "src/test/feature-session.tsx",
];
const featureUiSource = new Set(
  featureUiFiles.filter((file) => file.startsWith("src/")),
);
const guidanceFiles = [
  ".agents/README.md",
  ".agents/evaluation/cases.json",
  ".agents/evaluation/run-template.json",
  ".agents/hooks/block-dangerous.mjs",
  ".agents/hooks/block-dangerous.sh",
  ".agents/hooks/post-edit-format.sh",
  ".agents/hooks/quality-gate.sh",
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
  ".agents/skills/design-ui/SKILL.md",
  ".agents/skills/review-pr/SKILL.md",
  ".agents/skills/start-issue/SKILL.md",
  ".agents/skills/validate-change/SKILL.md",
  ".claude/skills/design-ui/SKILL.md",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  "CLAUDE.md",
  "DESIGN.fa.md",
  "DESIGN.md",
  "SECURITY.fa.md",
  "SECURITY.md",
  "docs/adr/0001-independent-runtimes.fa.md",
  "docs/adr/0001-independent-runtimes.md",
  "docs/adr/0002-lightweight-clean-api.fa.md",
  "docs/adr/0002-lightweight-clean-api.md",
  "docs/adr/0003-single-active-language.fa.md",
  "docs/adr/0003-single-active-language.md",
  "docs/adr/0004-cookie-proxy-and-sessions.fa.md",
  "docs/adr/0004-cookie-proxy-and-sessions.md",
  "docs/adr/0005-independent-repositories.fa.md",
  "docs/adr/0005-independent-repositories.md",
  "docs/adr/README.fa.md",
  "docs/adr/README.md",
  "docs/ai-code-understanding.fa.md",
  "docs/ai-code-understanding.md",
  "docs/architecture.fa.md",
  "docs/architecture.md",
  "docs/change-workflow.fa.md",
  "docs/change-workflow.md",
  "docs/comprehension-evaluation.fa.md",
  "docs/comprehension-evaluation.md",
  "docs/source-navigation.fa.md",
  "docs/source-navigation.md",
  "scripts/ai-hooks.portable.test.mjs",
  "scripts/check-guidance.mjs",
  "scripts/guidance.test.mjs",
];
const maintainedSupportFiles = [
  ".coderabbit.yaml",
  ".gitattributes",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/sonar.yml",
  ".gitignore",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  "AGENTS.md",
  "CONTRIBUTING.fa.md",
  "CONTRIBUTING.md",
  "README.fa.md",
  "README.md",
  "docs/bootstrap.fa.md",
  "docs/bootstrap.md",
  "docs/branch-protection.fa.md",
  "docs/branch-protection.md",
  "docs/sonarqube.fa.md",
  "docs/sonarqube.md",
  "eslint.config.mjs",
  "scripts/boundaries.test.mjs",
  "scripts/check-boundaries.mjs",
  "scripts/run-audit.mjs",
  "scripts/run-audit.test.mjs",
  "sonar-project.properties",
  "vitest.config.ts",
];
const integrationToolingFiles = [
  "docs/accessibility.fa.md",
  "docs/accessibility.md",
  "docs/test-reliability.fa.md",
  "docs/test-reliability.md",
  "docs/testing.fa.md",
  "docs/testing.md",
  "docs/validation.fa.md",
  "docs/validation.md",
  "docs/visual-regression.fa.md",
  "docs/visual-regression.md",
  "docs/website-csp.fa.md",
  "docs/website-csp.md",
  "docs/website-performance.fa.md",
  "docs/website-performance.md",
  "scripts/api-repository.mjs",
  "scripts/api-repository.test.mjs",
  "scripts/check-bundle-website.mjs",
  "scripts/visual-environment.mjs",
  "scripts/visual-environment.test.mjs",
  "scripts/website-performance-environment.mjs",
  "scripts/website-performance.test.mjs",
];
const integrationToolingPaths = new Set(integrationToolingFiles);
const deliveryToolingFiles = [
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
const deliveryToolingPaths = new Set(deliveryToolingFiles);
const publicDeliveryExamples = new Set([
  ".env.example",
  "deploy/docker/.env.example",
  "deploy/native/hosts.env.example",
  "deploy/native/website.env.example",
]);
const runnerFoundationFiles = [
  "docs/runner-foundation.fa.md",
  "docs/runner-foundation.md",
  "scripts/analyze-website-performance.mjs",
  "scripts/analyze-website-performance.test.mjs",
  "scripts/runner-inputs.mjs",
  "scripts/runner-inputs.test.mjs",
  "scripts/runner-process.mjs",
  "scripts/runner-process.test.mjs",
  "scripts/start-website.mjs",
  "scripts/start-website.test.mjs",
  "scripts/test-website-api.mjs",
  "scripts/test-website-api.test.mjs",
  "scripts/test-website-server.mjs",
  "scripts/test-website-server.test.mjs",
];
const runnerFoundationPaths = new Set(runnerFoundationFiles);
const browserFoundationFiles = [
  "docs/browser-foundation.fa.md",
  "docs/browser-foundation.md",
  "e2e/operations/smoke.spec.ts",
  "e2e/operations/staging.spec.ts",
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
  "scripts/browser-inputs.mjs",
  "scripts/browser-inputs.test.mjs",
  "scripts/playwright-config.mjs",
  "scripts/playwright-config.test.mjs",
  "scripts/run-visual.mjs",
  "scripts/test-csp-report-only.mjs",
  "scripts/test-csp-report-only.test.mjs",
  "scripts/visual.test.mjs",
  "tsconfig.tooling.json",
];
const browserFoundationPaths = new Set(browserFoundationFiles);
const apiFixtureFiles = [
  "docs/api-fixture.fa.md",
  "docs/api-fixture.md",
  "scripts/api-fixture-test-support.mjs",
];
const apiFixturePaths = new Set(apiFixtureFiles);
const applicationGuidanceFiles = [
  "docs/README.fa.md",
  "docs/README.md",
  "docs/application.fa.md",
  "docs/application.md",
  "docs/seo.fa.md",
  "docs/seo.md",
  "docs/qa/independent-website-verification.fa.md",
  "docs/qa/independent-website-verification.md",
  "docs/qa/requirements-audit-2026-10-24.fa.md",
  "docs/qa/requirements-audit-2026-10-24.md",
  "docs/qa/roadmap-status-2026-10-24.fa.md",
  "docs/qa/roadmap-status-2026-10-24.json",
  "docs/qa/roadmap-status-2026-10-24.md",
  "docs/qa/source-comprehension-2026-10-24.fa.md",
  "docs/qa/source-comprehension-2026-10-24.md",
  "docs/qa/standalone-layout-2026-10-24.fa.md",
  "docs/qa/standalone-layout-2026-10-24.md",
  "docs/qa/source-originals/vitest.tooling.config.ts",
];
const applicationGuidancePaths = new Set(applicationGuidanceFiles);
const applicationFiles = [
  "e2e/visual/baselines/win32/metadata.json",
  "e2e/visual/baselines/win32/website-home-en-dark.png",
  "e2e/visual/baselines/win32/website-home-fa-dark.png",
  "e2e/visual/baselines/win32/website-login-en-light.png",
  "e2e/visual/baselines/win32/website-register-fa-light.png",
  "knip.json",
  "next-env.d.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "scripts/application-checks.mjs",
  "scripts/application-checks.test.mjs",
  "src/app/(auth)/forgot-password/page.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/(auth)/login/page.tsx",
  "src/app/(auth)/register/page.tsx",
  "src/app/[...rest]/page.tsx",
  "src/app/account/page.tsx",
  "src/app/api/[...path]/route.ts",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/globals.css",
  "src/app/icon.svg",
  "src/app/layout.tsx",
  "src/app/not-found.tsx",
  "src/app/page.tsx",
  "src/app/robots.ts",
  "src/app/runtime-composition.test.tsx",
  "src/app/sitemap.ts",
  "src/app/social-image/route.tsx",
  "src/i18n/request.ts",
  "src/proxy.test.ts",
  "src/proxy.ts",
  "src/shared/runtime-adapters.test.ts",
  "src/shared/security/nonce.ts",
  "src/shared/settings/server.ts",
  "src/website/home/Home.tsx",
  "src/website/layouts/AuthLayout.tsx",
  "src/website/layouts/Footer.tsx",
  "src/website/layouts/Header.tsx",
  "src/website/layouts/HeaderAccountLink.tsx",
  "src/website/runtime-client.test.tsx",
];
const applicationPaths = new Set(applicationFiles);
const operationsFiles = [
  ".github/workflows/codeql.yml",
  ".github/workflows/dast.yml",
  ".github/workflows/deployment-smoke.yml",
  ".github/workflows/package-release.yml",
  ".github/workflows/release.yml",
  ".github/workflows/staging.yml",
  "components.json",
  "deploy/docker/smoke.mjs",
  "deploy/docker/smoke.test.mjs",
  "scripts/operations-checks.mjs",
  "scripts/operations-checks.test.mjs",
  "scripts/run-website-performance.mjs",
  "scripts/run-website-performance.test.mjs",
];
const operationsPaths = new Set(operationsFiles);
const applicationPhases = new Set(["application", "operations"]);
const applicationGuidancePhases = new Set([
  "application-guidance",
  ...applicationPhases,
]);
const apiFixturePhases = new Set(["api-fixture", ...applicationGuidancePhases]);
const browserPhases = new Set(["browser-foundation", ...apiFixturePhases]);
const runnerPhases = new Set(["runner-foundation", ...browserPhases]);
const deliveryPhases = new Set(["delivery-tooling", ...runnerPhases]);
const toolingPhases = new Set(["integration-tooling", ...deliveryPhases]);
const isPublishedSource = (file, phase) =>
  foundationSource.has(file) ||
  ([
    "localization",
    "server-boundary",
    "client-document",
    "client-ui",
    "feature-ui",
  ].includes(phase) &&
    localizationSource.has(file)) ||
  (["server-boundary", "client-document", "client-ui", "feature-ui"].includes(
    phase,
  ) &&
    serverBoundarySource.has(file)) ||
  (["client-document", "client-ui", "feature-ui"].includes(phase) &&
    clientDocumentSource.has(file)) ||
  (["client-ui", "feature-ui"].includes(phase) && clientUiSource.has(file)) ||
  (phase === "feature-ui" && featureUiSource.has(file));
const publicationScopes = {
  operations:
    "Published operational workflows, readiness-first owned Docker and advisory Lighthouse runners, manual release/browser wrappers and generator metadata over the complete runnable application. Source and injected owner tests do not establish a Docker engine, remote target, release, hosted security scan or lab result; each needs its separate authorization and current evidence.",
  application:
    "Published runnable standalone Next.js application, routes, CSS, browser configuration and independently installed synthetic API integration. Exact source closure does not establish execution: the complete application gate must separately record genuine build, browser/CSP and visual results; historical screenshots and metadata remain historical until a current compatibility check succeeds.",
  "application-guidance":
    "Published phase-aware application acceptance guidance and dated source archives over the unchanged API fixture prerequisite. The readiness guard still refuses this non-runnable snapshot; historical reports and archived configuration are not current execution evidence or active application, browser, visual or deployment configuration.",
  "api-fixture":
    "Published immutable API fixture identity and installation checks, explicit isolated API test configuration and corrected browser runner inputs with owned synthetic Node tests. The readiness guard still refuses this non-runnable snapshot; these checks do not establish an executed API/browser integration, application build, screenshot comparison or deployment.",
  "browser-foundation":
    "Published readiness-first browser configuration, visual/CSP orchestration and authored Playwright suites with installed SDK type checking and owned synthetic Node tests. The readiness guard refuses this non-runnable snapshot; authored suites are not browser, accessibility, visual, API compatibility, application build or deployment execution evidence.",
  "runner-foundation":
    "Published readiness-first Node process/input, standalone/API fixture and analysis runners with owned local subprocess tests. The readiness guard refuses this non-runnable snapshot; no real Next.js build/start, independent API compatibility, browser, Docker or deployment execution is established.",
  "delivery-tooling":
    "Published local artifact preparation, public configuration/target validation and inert delivery templates with owned synthetic tests. The readiness guard refuses this non-runnable snapshot; no application build, API, browser, Docker engine, deployment, release or provider workflow activation is established.",
  "integration-tooling":
    "Published deterministic bundle, fixture-location, performance-environment and visual-environment helpers with owned synthetic tests and phase-accurate guidance over unchanged local feature/UI support. No application build, API fixture, browser, screenshot, Lighthouse, accessibility or deployment execution is established.",
  guidance:
    "Published portable guidance, source navigation, optional host hooks and architecture/design records over the unchanged local feature/UI support. This is not a runnable application or proof of assistant discovery, browser behavior, deployment or model comprehension.",
  "feature-ui":
    "Published local authentication/account forms, scoped-session ownership and UI support with real HTTP/React tests; framework navigation is mocked. Next.js routes, server rendering, browser journeys, CSS and deployment remain unpublished and unvalidated.",
  "client-ui":
    "Published client HTTP/document support and independently tested local UI primitives, session/theme providers, countdown and motion adapters; Next.js pages/routes, styled browser journeys, full framework rendering and deployment are not published or validated.",
  "client-document":
    "Published client HTTP and document support, explicit client message selection and catalogs verified with the real ICU engine, SEO, private Web Vitals delivery and verified local fonts; Next.js routes/UI, server rendering, browser behavior and deployment are not published or validated.",
  "server-boundary":
    "Published contracts, catalogs, API forwarding and pure CSP helpers; Next.js routes/UI, nonce integration, browser behavior and deployment are not published or validated.",
  governance:
    "Published governance files only; website runtime is not published or validated.",
  foundation:
    "Published wire contracts, input helpers and settings-language loading only; Next.js UI, routes, browser behavior and deployment are not published or validated.",
  localization:
    "Published contracts, input helpers, API-authoritative settings-language loading and complete local catalogs; Next.js UI, rendering, browser behavior and deployment are not published or validated.",
};

const requiredPublicationFiles = (phase, sourcePhase) => [
  ...coreFiles,
  ...(sourcePhase === "governance"
    ? [".github/workflows/bootstrap.yml"]
    : foundationFiles),
  ...([
    "localization",
    "server-boundary",
    "client-document",
    "client-ui",
    "feature-ui",
  ].includes(sourcePhase)
    ? localizationFiles
    : []),
  ...([
    "server-boundary",
    "client-document",
    "client-ui",
    "feature-ui",
  ].includes(sourcePhase)
    ? serverBoundaryFiles
    : []),
  ...(["client-document", "client-ui", "feature-ui"].includes(sourcePhase)
    ? clientDocumentFiles
    : []),
  ...(["client-ui", "feature-ui"].includes(sourcePhase) ? clientUiFiles : []),
  ...(sourcePhase === "feature-ui" ? featureUiFiles : []),
  ...(["guidance", ...toolingPhases].includes(phase) ? guidanceFiles : []),
  ...(toolingPhases.has(phase)
    ? [...maintainedSupportFiles, ...integrationToolingFiles]
    : []),
  ...(deliveryPhases.has(phase) ? deliveryToolingFiles : []),
  ...(runnerPhases.has(phase) ? runnerFoundationFiles : []),
  ...(browserPhases.has(phase) ? browserFoundationFiles : []),
  ...(apiFixturePhases.has(phase) ? apiFixtureFiles : []),
  ...(applicationGuidancePhases.has(phase) ? applicationGuidanceFiles : []),
  ...(applicationPhases.has(phase) ? applicationFiles : []),
  ...(phase === "operations" ? operationsFiles : []),
];

/** Return the exact maintained file closure for a named publication phase. */
export const publicationInventory = (phase) => {
  if (!Object.hasOwn(publicationScopes, phase))
    throw new Error("Unknown publication phase.");
  const sourcePhase = ["guidance", ...toolingPhases].includes(phase)
    ? "feature-ui"
    : phase;
  return [...new Set(requiredPublicationFiles(phase, sourcePhase))];
};

const rejectsProtectedPublicationPath = (file, phase) => {
  const deliveryPhase = deliveryPhases.has(phase);
  const deploymentPath = file === "deploy" || file.startsWith("deploy/");
  const publishedDeployment =
    deliveryToolingPaths.has(file) ||
    (phase === "operations" && operationsPaths.has(file));
  const localSettingsPath =
    /(?:^|\/)(?:\.env(?:\.|$)|[^/]+\.env(?:\.|$)|settings\.local\.json$)/i.test(
      file,
    );
  return (
    (deploymentPath && (!deliveryPhase || !publishedDeployment)) ||
    (localSettingsPath && (!deliveryPhase || !publicDeliveryExamples.has(file)))
  );
};

const isToolingPathOutsidePhase = (file, phase) =>
  (!toolingPhases.has(phase) &&
    (integrationToolingPaths.has(file) || deliveryToolingPaths.has(file))) ||
  (!runnerPhases.has(phase) && runnerFoundationPaths.has(file)) ||
  (!browserPhases.has(phase) && browserFoundationPaths.has(file)) ||
  (!apiFixturePhases.has(phase) && apiFixturePaths.has(file)) ||
  (!applicationGuidancePhases.has(phase) &&
    applicationGuidancePaths.has(file)) ||
  (!applicationPhases.has(phase) && applicationPaths.has(file)) ||
  (phase !== "operations" && operationsPaths.has(file));

export const validateBootstrapPolicy = (policy) => {
  if (
    policy?.schemaVersion !== 1 ||
    !Object.hasOwn(publicationScopes, policy.phase) ||
    policy.applicationReady !== applicationPhases.has(policy.phase) ||
    policy.maximumChangedFiles !== 100 ||
    !Array.isArray(policy.allowedFiles) ||
    !policy.allowedFiles.length
  )
    throw new Error(
      "An explicit publication phase and matching readiness are required.",
    );
  const sourcePhase = ["guidance", ...toolingPhases].includes(policy.phase)
    ? "feature-ui"
    : policy.phase;
  const files = new Set();
  for (const file of policy.allowedFiles) {
    if (
      typeof file !== "string" ||
      !file ||
      file.includes("\\") ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      (/[*?[\]{}:\0\r\n]/.test(file) &&
        !(applicationPhases.has(policy.phase) && applicationPaths.has(file))) ||
      /^(?:apps|packages|drizzle|collection|node_modules|server|coverage)(?:\/|$)/.test(
        file,
      ) ||
      rejectsProtectedPublicationPath(file, policy.phase) ||
      file === "drizzle.config.ts" ||
      (file.startsWith("src/") &&
        (policy.phase === "governance" ||
          (!isPublishedSource(file, sourcePhase) &&
            !(
              applicationPhases.has(policy.phase) && applicationPaths.has(file)
            )))) ||
      (policy.phase === "governance" &&
        /^package(?:-lock)?\.json$/.test(file)) ||
      /\.(?:pem|key|pfx|p12|sqlite|db)$/.test(file) ||
      isToolingPathOutsidePhase(file, policy.phase) ||
      files.has(file)
    )
      throw new Error(
        "Publication files must be unique, exact paths within their declared phase.",
      );
    files.add(file);
  }
  const requiredFiles = requiredPublicationFiles(policy.phase, sourcePhase);
  if (requiredFiles.some((file) => !files.has(file)))
    throw new Error(
      "The bootstrap policy cannot omit its mandatory guard files.",
    );
  if (toolingPhases.has(policy.phase)) {
    const declaredClosure = new Set(requiredFiles);
    if ([...files].some((file) => !declaredClosure.has(file)))
      throw new Error(
        "Tooling files must match the closed published inventory.",
      );
  }
  return files;
};

export const inspectBootstrap = async (root) => {
  if (
    (await lstat(path.join(root, ".github"))).isSymbolicLink() ||
    (await lstat(path.join(root, policyPath))).isSymbolicLink()
  )
    throw new Error("Bootstrap snapshots must not contain symbolic links.");
  const policy = JSON.parse(
    await readFile(path.join(root, policyPath), "utf8"),
  );
  const allowed = validateBootstrapPolicy(policy);
  const directories = new Set(
    [...allowed].flatMap((file) => {
      const parts = file.split("/");
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );
  const found = new Set();
  const visit = async (directory) => {
    const entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === ".git") return;
        if (
          policy.phase !== "governance" &&
          [
            "node_modules",
            "coverage",
            ...(applicationPhases.has(policy.phase)
              ? [
                  ".next",
                  "playwright-report",
                  "test-results",
                  ...(policy.phase === "operations"
                    ? [".lighthouseci", "dist"]
                    : []),
                ]
              : []),
          ].includes(relative)
        ) {
          if (entry.isSymbolicLink() || !entry.isDirectory())
            throw new Error(
              "Generated output must be an ordinary root directory.",
            );
          return;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            "Bootstrap snapshots must not contain symbolic links.",
          );
        if (entry.isDirectory() && directories.has(relative)) {
          await visit(relative);
        } else if (entry.isFile() && allowed.has(relative)) {
          found.add(relative);
        } else {
          throw new Error(`Unexpected bootstrap path: ${relative}`);
        }
      }),
    );
  };
  await visit("");
  if ([...allowed].some((file) => !found.has(file)))
    throw new Error(
      "The published bootstrap snapshot is missing declared files.",
    );

  await Promise.all(
    [...found].map(async (file) => {
      if (file.endsWith(".json"))
        JSON.parse(await readFile(path.join(root, file), "utf8"));
      if (file.endsWith(".md")) {
        const markdown = (
          await readFile(path.join(root, file), "utf8")
        ).replace(/```[\s\S]*?```/g, "");
        for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
          const link = match[1];
          if (/^(?:https?:|mailto:|#)/.test(link)) continue;
          const target = path
            .relative(
              root,
              path.resolve(
                path.dirname(path.join(root, file)),
                decodeURI(link.split("#")[0]),
              ),
            )
            .replaceAll(path.sep, "/");
          if (!allowed.has(target) && !directories.has(target))
            throw new Error(
              "Maintained document link is outside the declared snapshot: " +
                file,
            );
        }
      }
      if (file.endsWith(".mjs")) {
        const result = spawnSync(
          process.execPath,
          ["--check", path.join(root, file)],
          {
            cwd: root,
            encoding: "utf8",
            windowsHide: true,
          },
        );
        if (result.error || result.status !== 0)
          throw new Error(`Bootstrap JavaScript syntax is invalid: ${file}`);
      }
    }),
  );
  return {
    applicationReady: policy.applicationReady,
    files: found.size,
    phase: policy.phase,
    scope: publicationScopes[policy.phase],
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await inspectBootstrap(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Bootstrap validation failed.",
    );
    process.exitCode = 1;
  }
}
