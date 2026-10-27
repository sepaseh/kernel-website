# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

This standalone TypeScript project is in its **server-boundary** phase.
`applicationReady` is **false**. The published scope contains twenty-four production
modules and five source test files:

- Six pure wire-contract modules under `src/shared/contracts`, feature-owned
  `types.ts` files and `src/shared/settings/contracts.ts`.
- Form-input helpers preserving password whitespace and normalizing mobile digits.
- Safe API-origin validation and a public-settings loader that preserves the
  server's active language/direction and uses uncached requests.
- Ten complete local translation catalogs with 107 flat string keys per language,
  a key type derived from English and an explicit lazy-loader registry.

- Web API forwarding with exact mutation-origin checks, bounded bodies, cookie-only
  sessions and safe uncached error responses; pure document CSP policy helpers.

Read [server boundary](docs/server-boundary.md) for behavior and remaining integration.
React/Next.js UI, routes, translation adapters, browser journeys and deployment
are not included. Catalog loading does not establish ICU rendering or browser
behavior. There are no runtime dependencies. Read [localization](docs/localization.md)
and the exact
[snapshot inventory](.github/bootstrap-policy.json).

## Install and validate

Use Node.js from [.nvmrc](.nvmrc), within the [package](package.json) engine range,
and the npm bundled with that Node.js release, matching CI.

```sh
npm ci
npm run validate -- full
```

The [canonical manifest](.agents/validation.json) defines all nine required phase
checks. Unit tests run in Node with synthetic fetch responses and dotenv loading
disabled. They produce `coverage/unit/lcov.info`; Node governance tests produce
`coverage/governance/lcov.info`. These are real measurements of the published source
and its tooling, not coverage of a running website. Reports are not committed.

Read [Contributing](CONTRIBUTING.md), the [phase guide](docs/bootstrap.md),
[branch protection](docs/branch-protection.md) and [Sonar setup](docs/sonarqube.md).
Each PR may change at most **100 GitHub file entries**. This limit applies to the
PR diff, not the total repository inventory. No hosted CI, review or Sonar result
is established merely by these local files.
