# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

This standalone TypeScript project is in its **feature-ui** phase.
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

Read [forms](docs/forms.md), [client UI](docs/client-ui.md), [session ownership](docs/session.md),
[client/document support](docs/client-document.md), [fonts](docs/fonts.md) and
[server boundary](docs/server-boundary.md) for behavior and remaining integration.
Next.js pages, root layout, request/translation adapters, a CSS pipeline, browser
journeys and deployment are not included. The installed support libraries are
explicitly declared in [package.json](package.json); production package imports
have exact owner, identity and runtime/type-only permissions. Next.js supplies erased document types, the isolated Web Vitals hook adapter and
feature-local link/router boundaries without a framework entry point. Read [localization](docs/localization.md) and the exact
[168-file snapshot inventory](.github/bootstrap-policy.json).

## Install and validate

Use Python 3.14.4 in an activated disposable environment outside the checkout for font verification. CI installs the pinned requirements on its temporary runner. Use Node.js from [.nvmrc](.nvmrc), within the [package](package.json) engine range,
and the npm bundled with that Node.js release, matching CI.

```sh
npm ci
python -m pip install --requirement font-source/requirements.txt
npm run validate -- full
```

The [canonical manifest](.agents/validation.json) defines all ten required phase
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
