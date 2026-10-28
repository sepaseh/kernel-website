# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

## Current API fixture prerequisite

The api-fixture phase retains the non-runnable browser source and applicationReady:false, with an exact 348-file inventory and the same eleven-check gate. [Independent API fixture](docs/api-fixture.md) defines the pinned public API adapter, fresh owned state, launcher port contract and strict SDK worker control. The foundation sections below retain their earlier phase scope; their prior structural-only API entry is superseded by the explicit revision/installation checks and published src/index.ts entry described in that guide. No real API/browser execution is established for this false snapshot. A later application PR needs its complete fifteen-check execution and protected merge transition.

This standalone TypeScript project is in its **api-fixture** phase.
`applicationReady` is **false**. The published scope contains sixty-six production
modules, thirty-four source test files and three test-support modules:

- Six pure wire-contract modules under `src/shared/contracts`, feature-owned
  `types.ts` files and `src/shared/settings/contracts.ts`.
- Form-input helpers preserving password whitespace and normalizing mobile digits.
- Safe API-origin validation and a public-settings loader that preserves the
  server's active language/direction and uses uncached requests.
- Ten complete local translation catalogs with 107 flat string keys per language,
  a key type derived from English and an explicit lazy-loader registry.

- Web API forwarding with exact mutation-origin checks, bounded bodies, cookie-only
  sessions and safe uncached error responses; pure document CSP policy helpers.
- A shared cookie/no-store HTTP client and five feature modules for twelve operations,
  explicit client message selection and catalogs tested with the real ICU engine.
- SEO data and safe JSON-LD, private optional Web Vitals delivery, class composition,
  and licensed self-hosted font assets with real binary verification and preload selection.
- Five local shadcn/Radix primitives, associated form fields and localized feedback,
  session/theme providers, theme preference, a bounded countdown, visible-first
  motion and a Web Vitals hook adapter.
- Login, shared registration/recovery OTP forms and account profile, username, email
  verification, password-change and logout controls; mount/session ownership
  protects local feedback and navigation from late results.

Portable [guidance](.agents/README.md), [source navigation](docs/source-navigation.md), [architecture](docs/architecture.md), [design](DESIGN.md), [ADRs](docs/adr/README.md) and [evaluation templates](docs/comprehension-evaluation.md) now accompany that existing production inventory. The current phase also corrects committed-mount activation of the existing operation guard; see [session ownership](docs/session.md). The indexes point only to published owners and tests. Optional host hooks/adapters do not establish automatic discovery, a benchmark result or runtime readiness.

Read [forms](docs/forms.md), [client UI](docs/client-ui.md), [session ownership](docs/session.md),
[client/document support](docs/client-document.md), [fonts](docs/fonts.md) and
[server boundary](docs/server-boundary.md) for behavior and remaining integration.
Next.js pages, root layout, request/translation adapters, a CSS pipeline, executed browser
journeys and deployment are not included. The installed support libraries are
explicitly declared in [package.json](package.json); production package imports
have exact owner, identity and runtime/type-only permissions. Next.js supplies erased document types, the isolated Web Vitals hook adapter and
feature-local link/router boundaries without a framework entry point. Read [localization](docs/localization.md) and the exact
[348-file snapshot inventory](.github/bootstrap-policy.json).

Dependabot version-update pull requests are configured with a zero limit while publication follows one open PR at a time. Repository security-update settings are separate and are not established by this local configuration. The future component-generator configuration and CSS integration are deferred.

## Install and validate

Use Python 3.14.4 in an activated disposable environment outside the checkout for font verification. CI installs the pinned requirements on its temporary runner. Use Node.js from [.nvmrc](.nvmrc), within the [package](package.json) engine range,
and the npm bundled with that Node.js release, matching CI.

```sh
npm ci
python -m pip install --requirement font-source/requirements.txt
npm run validate -- full
```

The [canonical manifest](.agents/validation.json) defines all eleven required phase
checks. Unit tests run in Node or isolated jsdom with real React/RTL, Radix,
next-intl and next-themes, synthetic fetch responses and dotenv loading disabled.
Feature tests use scoped auth/account messages and the real HTTP/session stack;
router and document navigation are mocked. Motion/framework-hook owner tests
document their mocks and static-markup limits.
They produce `coverage/unit/lcov.info`; Node governance tests produce
`coverage/governance/lcov.info`. These are real measurements of the published source
and its tooling, not coverage of a running website. Reports are not committed.

Read [Contributing](CONTRIBUTING.md), the [phase guide](docs/bootstrap.md),
[branch protection](docs/branch-protection.md) and [Sonar setup](docs/sonarqube.md).
Each PR may change at most **100 GitHub file entries**. This limit applies to the
PR diff, not the total repository inventory. No hosted CI, review or Sonar result
is established merely by these local files.

The retained integration tooling provides four independent quality helpers: explicit synthetic API fixture location, bundle/budget measurement, an allowlisted performance environment and visual metadata/locking utilities. Three Node owner-test files exercise them using disposable synthetic files. Read [testing](docs/testing.md), [validation](docs/validation.md), [performance](docs/website-performance.md), [visual limits](docs/visual-regression.md), [CSP](docs/website-csp.md), [accessibility](docs/accessibility.md) and [test reliability](docs/test-reliability.md). These helpers do not start an API or a browser; the readiness-first Node runner foundation below extends this evidence without activating the application.

Delivery preparation adds eight Node helpers for owned artifact copying/packaging, phase readiness, explicit health checks, public configuration validation/rendering, scoped cleanup and target validation. Six Node owner-test files join measured governance coverage; existing audit regression cases retain their measured Vitest unit ownership. The [delivery guides](docs/deployment.md), [release operations](docs/release-operations.md), [releasing](docs/releasing.md), [staging](docs/staging.md) and passive native/Docker templates describe future operator acceptance. The source remains non-runnable: core CLIs reject its false readiness marker before operations. Synthetic fixture success is not a Next.js build, installed API, container, deployment or release. [Changelog](CHANGELOG.md) distinguishes imported history from current evidence.

The [runner foundation](docs/runner-foundation.md) adds six Node modules and six measured Node owner-test files for explicit inputs, direct-child lifecycle, standalone/API fixture launching and bounded analysis output. The website, API, server and analyzer entry operations read the public readiness marker first and refuses this snapshot with applicationReady:false. Imports do not load dotenv, mutate the environment or launch a service. Tests run owned synthetic Node programs, including failure and cancellation; they do not execute a real Next.js build/start, independent API, browser, Docker engine or lab analysis. The unchanged eleven-check gate measures the new tooling without weakening thresholds or excluding source. The [browser foundation](docs/browser-foundation.md) now adds typed authored suites, readiness-first Playwright configuration and visual/CSP orchestration. Four Node owner files measure guards and injected behavior; browser binaries, independent APIs and real browser/visual execution remain deferred.
