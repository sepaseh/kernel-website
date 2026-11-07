# Browser tooling reference

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use this reference when changing browser inputs, configuration or visual/CSP
orchestration. Start with [development](development.md) to provision and run the
application, [API fixtures](api-fixture.md) for the local HTTP responder, and
[validation](validation.md) for complete checking. Authored suites and installed
SDK types are source; only actual execution establishes a browser result.

The `operations` phase delivers website composition with `applicationReady: true`.
The tooling still rejects false or invalid markers before reading operation
inputs or starting a browser. Never change a marker merely to enter an operation;
actual build, browser/CSP and visual acceptance require the delivered composition,
local HTTP fixture and reviewed browser described in [validation](validation.md).

## Published owners

| Owner                                                         | Responsibility                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Browser inputs](../scripts/browser-inputs.mjs)               | Readiness, root-owned Playwright identity, explicit synthetic origins and local HTTP fixture selection.               |
| [Configuration factory](../scripts/playwright-config.mjs)     | Guarded website, visual, smoke and staging configuration; constructing data starts no browser and contacts no target. |
| [Visual runner](../scripts/run-visual.mjs)                    | Owned probe/CLI lifecycle, platform/browser/source metadata and pending-before-update ordering.                       |
| [Report-only CSP runner](../scripts/test-csp-report-only.mjs) | Guarded invocation of the CSP scenario with an explicit report-only mode and owned child process.                     |

Each owner has its matching `*.test.mjs` suite. The thin
[website](../playwright.website.config.ts), [visual](../playwright.visual.config.ts),
[smoke](../playwright.smoke.config.ts) and [staging](../playwright.staging.config.ts)
entries import SDK types only and await `loadPlaywrightConfig`. A false or invalid
readiness marker rejects loading before environment values, SDK files or targets
are inspected. Helper-module imports remain inert; positive guard tests use
explicitly marked temporary roots.

## Dependency and input boundaries

The package pins Playwright `1.64.1` and Axe integration `4.14.0`.
[Tooling typechecking](../tsconfig.tooling.json) compiles the authored suites and
four configurations against installed types. The resolver verifies the selected
root's package name, exact declaration, lock entry, installed identity and fixed
unlinked CLI/module paths. There is no parent/global SDK fallback. Browser
provisioning and actual browser execution remain separate checks; visual
children use the selected installation's project-local browser location.

Synthetic inputs require canonical, distinct HTTP IPv4 loopback origins with
explicit nonzero ports, a matching website host/port, disabled indexing,
`KERNEL_SYNTHETIC_ENV=1`. The [local fixture contract](api-fixture.md) supplies
test-only HTTP responses from this repository. Website/visual configuration starts
fresh owned API and website processes with `reuseExistingServer:false`.
It forwards website-origin parent settings; the API launcher alone derives its
child port. Helpers use validated inputs without fixed-port or existing-service
fallbacks.

Playwright merges its ambient parent environment into web-server children.
A configuration's `env` dictionary alone cannot remove private inherited values.
`loadPlaywrightConfig` therefore validates parent key names after readiness and
before values, SDK or targets are read. Unknown keys, symbols, `NODE_OPTIONS` and
source-transform hooks are rejected with bounded names-only diagnostics.
The reviewed `PLAYWRIGHT_TEST` worker marker must be a data property containing
the literal string `1`, and requires the installed Playwright `1.64.1` identity.
Exact Windows runtime names are allowed only on Windows without inspecting their
values. Direct SDK execution needs an explicitly filtered parent, as supplied by
the owned launchers; `createPlaywrightConfig` is a guarded data factory, not this
executable parent boundary.

Smoke/staging inputs additionally require explicit allowed application/API hosts
and targets; smoke checks matching selected/expected deployment IDs. The factory
places validated targets in configuration metadata. This grants no authority to
contact an operator environment; follow [operations](release-operations.md) and
[staging](staging.md).

## Authored scenarios and visual evidence

The website scenarios cover authentication/account behavior,
session isolation, client boundaries, API-selected language/direction, SEO, both
CSP modes, accessibility, fonts and performance. Their
[helpers](../e2e/website/helpers.ts) remain test infrastructure. The SEO scenario's
extra standalone process uses the same readiness, unlinked-file and direct-child
lifecycle contracts. [Smoke](../e2e/operations/smoke.spec.ts) and
[staging](../e2e/operations/staging.spec.ts) are separately authorized operational
scenarios.

Application, accessibility, SEO and CSP acceptance are disjoint named suites in
the [manifest](../.agents/validation.json). Each consumes the same source-bound
production build through [build verification](../scripts/verification-build.mjs).
CSP runs its scenarios once in enforce mode and once in report-only mode;
font/resource assertions remain with application journeys and do not measure a
Lighthouse score. Manual smoke and staging keep their own target boundaries.

[Visual scenes](../e2e/visual/website.spec.ts) and
[font readiness](../e2e/visual/readiness.ts) use explicit viewport, reduced motion,
browser/channel, snapshot names and pixel tolerances. Comparison enforces
matching platform and SDK/browser versions plus recorded baseline review fields.
The runner records current source fingerprints and environment metadata for
review; those fields do not prove matching fonts, configuration or source bytes.
Update mode marks review pending before capture can
change images; failed or partial capture stays pending. CI baseline updates are
forbidden. Preserve baseline bytes and dates; an authorized update requires real
visual review. See [visual regression](visual-regression.md).

## Verification boundaries

Node owner cases test guarded ordering with poisoned getters, synthetic SDK
metadata, disposable CLI/module programs, rejected inputs, configuration and
owned cleanup. They launch no real browser, Next application or
Docker engine. Strict compilation similarly establishes type compatibility only.
A false-marker gate does not execute authored browser cases or count them as
skipped successes.

Current-tree build/browser/CSP/visual results belong to the complete
[validation procedure](validation.md) and [application acceptance](application.md).
The actual browser suites exercise the real website against synthetic HTTP
responses; they do not establish compatibility with an external backend. Real
hosted jobs and protected merge requirements remain separate from local results. [Runner limits](runner-foundation.md) apply, including direct-child
ownership without descendant supervision; Docker/Lighthouse operations do not
replace application acceptance.
