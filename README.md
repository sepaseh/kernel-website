# Kernel Website

The current publication phase is **browser-foundation** and application readiness is **false**. The marker describes admitted source, not a successful local run, hosted check or deployment.

Runnable application composition is not declared for this phase. Published helpers, authored suites and installed dependencies do not prove a running application.

## Published source

- Authentication flows, HTTP consumers and session ownership.
- Account forms, contracts and requests.
- Home reveal behavior and shared frontend controls.
- SEO, CSP and optional Web Vitals delivery helpers.
- Pure local catalogs: ten JSON message resources and three TypeScript catalog contracts/tests.
- Licensed font source and real font verification.
- Guarded Node runners, a synthetic HTTP fixture and deployment templates.
- Guarded browser tooling, authored typed browser/visual suites and retained baseline images.

The [runner contracts](docs/runner-foundation.md), [browser tooling](docs/browser-foundation.md),
[HTTP fixture](docs/api-fixture.md) and [deployment references](docs/deployment.md)
are exercised through isolated owner tests. Tooling typechecking verifies the
authored suites against installed types. Application launch, build, browser,
packaging and delivery commands remain blocked by the false readiness marker;
neither compilation nor historical screenshots establish browser execution.

Start with [Contributing](CONTRIBUTING.md), [task navigation](docs/source-navigation.md), [source scope](docs/bootstrap.md) and [exact-tree validation](docs/validation.md). [AGENTS](AGENTS.md) owns assistant entry instructions.

Use the exact Node version in [.nvmrc](.nvmrc), freshly install the locked dependencies in an owned verification export and run `npm run validate -- full`. The [manifest](.agents/validation.json) owns every required command.

[Branch protection](docs/branch-protection.md), [review preflight](docs/reviews.md) and [SonarQube Cloud](docs/sonarqube.md) distinguish configured policy from current-head hosted results. See [Security](SECURITY.md) for private reporting.
