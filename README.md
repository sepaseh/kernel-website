# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

This independent TypeScript frontend uses the [source marker and exact inventory](.github/bootstrap-policy.json) for publication scope and the [canonical manifest](.agents/validation.json) for commands. The operations phase retains complete Next App Router composition with `applicationReady:true` and adds the final development and operational tools: 420 source files, 90 product modules, 38 source test files and three source test-support modules. Readiness describes source completeness; exact-tree acceptance and any external operation still require their own actual evidence.

Local product owners provide authentication/account forms, reviewed UI primitives, session/theme providers, ten complete 107-key flat catalogs, cookie/no-store HTTP and forwarding, API-owned language/direction, pure CSP/SEO support, optional private Web Vitals and licensed self-hosted fonts. Read [architecture](docs/architecture.md), [forms](docs/forms.md), [session](docs/session.md), [localization](docs/localization.md), [client/document support](docs/client-document.md) and [fonts](docs/fonts.md).

The independent API owns authentication, settings, persistence and storage. Consume it through HTTP; no cross-checkout source imports, workspaces or local links. Package imports have explicit owner/identity permissions. The [fixture contract](docs/api-fixture.md) pins a public API revision, clean source, independently installed dependencies, fresh owned state and strict launcher inputs. Synthetic Node owner tests verify adapter contracts; the application gate separately requires actual execution of that independent fixture and the browser.

## Install and validate

Use Node from [.nvmrc](.nvmrc), its bundled npm and Python 3.14.4 in an activated disposable environment outside source. Independently install the pinned public API as described in [the fixture guide](docs/api-fixture.md), and select its absolute path with `KERNEL_API_DIRECTORY`; never select an existing service or discover a sibling checkout.

For the synthetic full profile, explicitly supply `KERNEL_SYNTHETIC_ENV=1`, `NODE_ENV=production`, `NPM_CONFIG_INCLUDE=dev`, `HOSTNAME=127.0.0.1`, distinct available website/API loopback origins and matching `PORT`, `WEBSITE_URL` and `API_BASE_URL`, plus `WEBSITE_INDEXING_ENABLED=false` and `PLAYWRIGHT_BROWSERS_PATH=0`. CI uses website port 3010 and API port 3100. Use the host shell’s environment syntax, not dotenv. Install the matching project-local Chromium with the declared Playwright SDK before the browser checks. The owned API runner generates its test-only secret and fresh state; supply no private credential.

```sh
npm ci
python -m pip install --requirement font-source/requirements.txt
npm run validate -- full
```

The current profile has fifteen required checks, including dead-code analysis, a real production build and bundle budget, browser journeys in enforcing/report-only CSP modes and Windows visual comparison. Real React/RTL, Radix, next-intl and next-themes also run in isolated unit environments with synthetic HTTP; navigation/motion mocks retain their documented limits. All product source, governance scripts and actual font binaries remain measured. Generated coverage and browser reports are not committed.

[Contributing](CONTRIBUTING.md), [testing](docs/testing.md) and [validation](docs/validation.md) define exact-tree acceptance. Every PR executes the full declared profile, including documentation. Each changes at most 100 GitHub entries. Keep one website PR open and create authorized PRs ready for review. Observe hosted CI, Sonar and review results for the current head; files alone do not prove provider success.

The manifest separately registers four manual operations (`deploy:package`, `test:smoke`, `test:staging`, `test:docker`) and advisory `perf:website`; none is executed by the required full profile. Review their explicit inputs and authorization in [operations](docs/release-operations.md), [staging](docs/staging.md), [Docker](deploy/docker/README.md) and [performance](docs/website-performance.md). [components.json](components.json) is optional generator metadata for the existing UI; generator use is not a runtime dependency.

## Integration and operations

[Application integration](docs/application.md) defines framework composition, CSS/configuration, all fifteen checks and actual build/browser/CSP/visual evidence with the independent synthetic API. The marker must agree with delivered source and checks; it cannot bypass missing acceptance.

Published tooling owns fixture/bundle/environment/visual checks, child lifecycle, guarded browser configuration and artifact/configuration/health/cleanup contracts. Imports are inert; core entries check readiness before operations. Node fixtures, authored suites and old images prove only their recorded scope. See [phase scope](docs/bootstrap.md), [runners](docs/runner-foundation.md), [browser foundation](docs/browser-foundation.md), [delivery](docs/deployment.md), [operations](docs/release-operations.md) and [protection](docs/branch-protection.md). Deployment and workflow dispatch need their own authorization.

[Documentation](docs/README.md) separates active guides from dated QA and archived originals. [Guidance](.agents/README.md), [navigation](docs/source-navigation.md), [design](DESIGN.md), [ADRs](docs/adr/README.md) and [evaluation](docs/comprehension-evaluation.md) describe ownership. Optional hooks/adapters do not prove automatic loading or model performance. Dependabot version-update PR limits stay zero during one-open-PR publication; security-update settings are separate.
