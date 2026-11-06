# Kernel Website

The current publication phase is **application** and application readiness is **true**. The marker describes admitted source, not a successful local run, hosted check or deployment.

This stage delivers application routes, providers and website composition. A source
marker or installed dependency does not prove a successful runtime check.

## Published source

- Authentication flows, HTTP consumers and session ownership.
- Account forms, contracts and requests.
- Home reveal behavior and shared frontend controls.
- SEO, CSP and optional Web Vitals delivery helpers.
- Pure local catalogs: ten JSON message resources and three TypeScript catalog contracts/tests.
- Licensed font source and real font verification.
- Guarded Node runners, a synthetic HTTP fixture and deployment templates.
- Guarded browser tooling, authored typed browser/visual suites and retained baseline images.
- Framework routes, application shell, providers and local HTTP request adapters.

The [application](docs/application.md), [runner contracts](docs/runner-foundation.md),
[browser tooling](docs/browser-foundation.md), [HTTP fixture](docs/api-fixture.md)
and [deployment references](docs/deployment.md) define the delivered contracts.
The full gate must execute real production build, browser/CSP and visual checks
with the disposable local fixture and reviewed browser. Compilation and historical
screenshots alone establish no browser execution or external backend compatibility.

Start with [Contributing](CONTRIBUTING.md), [task navigation](docs/source-navigation.md), [source scope](docs/bootstrap.md) and [exact-tree validation](docs/validation.md). [AGENTS](AGENTS.md) owns assistant entry instructions.

Use the exact Node version in [.nvmrc](.nvmrc), freshly install the locked dependencies in an owned verification export and run `npm run validate -- full`. The [manifest](.agents/validation.json) owns every required command.

[Branch protection](docs/branch-protection.md), [review preflight](docs/reviews.md) and [SonarQube Cloud](docs/sonarqube.md) distinguish configured policy from current-head hosted results. See [Security](SECURITY.md) for private reporting.
