# Kernel Website

This **governance** publication establishes repository validation, assistant
guidance and protected-review policy in one standalone npm package.
Application readiness is **false**; no runnable website is delivered here.

Start with [Contributing](CONTRIBUTING.md), [task navigation](docs/source-navigation.md)
and [exact-tree validation](docs/validation.md). Assistant entry points are
[AGENTS.md](AGENTS.md) and [the guidance index](.agents/README.md).

Use the exact Node version in [.nvmrc](.nvmrc), freshly install the locked
dependencies and run `npm run validate -- full` in an owned verification export.
The [manifest](.agents/validation.json) defines all ten required checks.
Dependency installation is not evidence of delivered application behavior.

[Branch protection](docs/branch-protection.md), [reviews](docs/reviews.md) and
[SonarQube Cloud](docs/sonarqube.md) distinguish configured policy from actual
current-head hosted results. [Security](SECURITY.md) explains private reporting.
