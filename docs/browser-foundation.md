# Browser tooling reference

Use this reference when changing browser inputs, configuration, screenshots or
CSP acceptance. For setup and execution, start with
[local development](development.md) and [exact-tree validation](validation.md).

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

Read the Playwright and Axe pins in [package.json](../package.json).
[Tooling typechecking](../tsconfig.tooling.json) compiles the authored suites and
four configurations against installed types. The resolver verifies the selected
root's package name, exact declaration, lock entry, installed identity and fixed
unlinked CLI/module paths. There is no parent/global SDK fallback. Browser
provisioning and browser execution use the selected installation's project-local
browser location. Set `PLAYWRIGHT_BROWSERS_PATH=0` before installing the pinned
Chromium with the reviewed SDK:

```sh
node node_modules/@playwright/test/cli.js install chromium
```

Synthetic inputs require canonical, distinct HTTP IPv4 loopback origins with
explicit nonzero ports, a matching website host/port, disabled indexing and
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

The website scenarios cover authentication and account behavior, session
isolation, client boundaries, API-selected language/direction, blog, contact,
FAQ, SEO, both CSP modes, accessibility, fonts and performance. Their
[helpers](../e2e/website/helpers.ts) remain test infrastructure. The SEO scenario's
extra standalone process uses the same readiness, unlinked-file and direct-child
lifecycle contracts. [Smoke](../e2e/operations/smoke.spec.ts) and
[staging](../e2e/operations/staging.spec.ts) are separately authorized operational
scenarios.

Application, accessibility, SEO and CSP acceptance are disjoint named suites in
the [manifest](../.agents/validation.json). Each consumes the same source-bound
production build through [build verification](../scripts/verification-build.mjs).
The browser wrapper verifies the build before launch and rechecks it after the
owned browser process exits, including after a failed suite. CSP runs in enforce
mode first and proceeds to a separate report-only run when enforce passes.
The application journeys check local fonts and resources. For Lighthouse, use
the [advisory performance procedure](website-performance.md).

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

For acceptance, execute the complete [validation procedure](validation.md)
against the local synthetic HTTP fixture. Record the exact source, browser
profile and result. See [runner process ownership](runner-foundation.md) for
cleanup and [branch protection](branch-protection.md) for hosted results.
