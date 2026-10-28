# Browser foundation and authored scenarios

[English](browser-foundation.md) · [فارسی](browser-foundation.fa.md)

## Source phase and evidence

The browser foundation introduced SDK-backed authored scenarios before application activation. Read the [source marker](../.github/bootstrap-policy.json) for the current exact inventory and [application contract](application.md) for acceptance. The application snapshot integrates pages, the root layout and CSS with `applicationReady:true` and a fifteen-check profile. Its Node owner tests and typed authored suites still establish only their own layer; actual browser/API execution and compatible visual comparison must be recorded separately for the exact application tree.

[Independent API fixture](api-fixture.md) defines the pinned public revision,
installation identity checks, fresh owned state, launcher port contract and SDK
worker control. These API checks supplement the browser SDK checks below; their
synthetic owner tests do not establish real wire compatibility.

## Published owners

| Owner                                                                                                                     | Responsibility                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Browser inputs](../scripts/browser-inputs.mjs) and [owner tests](../scripts/browser-inputs.test.mjs)                     | Readiness first, exact root-owned Playwright identity, explicit loopback website/API settings and an explicitly selected synthetic API fixture.          |
| [Configuration factory](../scripts/playwright-config.mjs) and [owner tests](../scripts/playwright-config.test.mjs)        | Construct website, visual, smoke or staging configuration as data after readiness and dependency validation; never launch a browser or contact a target. |
| [Visual runner](../scripts/run-visual.mjs) and [owner tests](../scripts/visual.test.mjs)                                  | Guarded visual orchestration, owned probe/CLI lifecycle, platform-specific review metadata and pending-before-update ordering.                           |
| [Report-only CSP runner](../scripts/test-csp-report-only.mjs) and [owner tests](../scripts/test-csp-report-only.test.mjs) | Guarded invocation of the authored CSP scenario using an explicit report-only test mode and the reviewed owned-process contract.                         |

The four thin [website](../playwright.website.config.ts),
[visual](../playwright.visual.config.ts), [smoke](../playwright.smoke.config.ts) and
[staging](../playwright.staging.config.ts) configurations import the SDK as types
only. Their executable default awaits the guarded configuration loader. The false
marker therefore rejects loading before environment values, installed SDK files
or operation targets are inspected. Ordinary helper-module imports remain inert.
Positive owner tests use their own marked temporary roots and disposable Node
programs, rather than changing the source marker.

## Dependency and input boundaries

Playwright and its Axe integration are exact local development dependencies. Strict [tooling typechecking](../tsconfig.tooling.json) includes all thirteen authored e2e TypeScript files and four configurations against the installed SDK types. This compilation is separate from browser provisioning/execution. The application profile registers actual website/browser, enforcing/report-only CSP and visual commands together with build/bundle and dead-code checks. Lighthouse, external staging/DAST and deployment have their own deferred operational acceptance.

The resolver checks the selected root's package name, exact declared Playwright
version, lockfile entry, installed package name/version and fixed unlinked CLI
entry. Visual probing additionally resolves its fixed local module entry. These
structural checks do not attest arbitrary package bytes, a browser executable,
an API revision or wire compatibility. No parent/global SDK fallback is used.

Synthetic website/API input requires canonical, distinct HTTP IPv4 loopback
origins with explicit nonzero ports, a matching website host/port, disabled
indexing, `KERNEL_SYNTHETIC_ENV=1` and an absolute explicit
`KERNEL_API_DIRECTORY`. The selected API must satisfy the reviewed [fixture-location contract](../scripts/api-repository.mjs) and the pinned independent Git/installation checks, using published src/index.ts as its entry. No sibling checkout is discovered.

Only declared public settings and runtime essentials reach owned child
processes; private state, credentials and `NODE_OPTIONS` are not test inputs.
Playwright itself merges the ambient parent environment into web-server children;
the configuration's `env` dictionary only adds or replaces values. All four
executable entries therefore call `loadPlaywrightConfig`, which checks parent
key names after readiness and before public/private value, SDK or target reads.
Unknown keys, `NODE_OPTIONS` and Playwright source-transform hooks are rejected
without reading their values. Only individually declared SDK controls are
allowed. Windows also supplies a fixed set of OS identity/path context names to
new children; those exact runtime names are permitted only on Windows, without
inspecting their values. A filtered dictionary alone does not remove that OS
context. Direct website SDK invocation must use an explicitly filtered parent,
as the owned visual/CSP launchers do; `createPlaywrightConfig` is a data factory,
not a replacement for this executable boundary.

Application acceptance requires provisioning the matching browser; visual children
use the selected installation's project-local browser location. Neither installation
of the npm SDK nor a fake probe in an owner test establishes a provisioned browser.

Website and visual configurations describe fresh owned API/website fixtures and
refuse to reuse an existing service. Authored helpers derive their origins from
the explicit validated public inputs, with no fixed-port or existing-service
fallback. The helpers retain seeded administrator/OTP expectations as future
fixture acceptance conditions. Those conditions must be reconciled with an
independently installed API at an immutable revision before actual execution.

Smoke and staging configurations require their explicit allowed application/API
hosts and targets after readiness. Smoke additionally requires matching expected
and selected deployment identifiers. Authored operation tests consume this
validated configuration metadata. Constructing this data grants no authority to
contact an operator environment; actual operational execution needs its own
authorization and acceptance evidence.

## Authored scenarios and visual evidence

The nine [website](../e2e/website/website.spec.ts) scenario source files describe
authentication/account, session isolation, client boundaries, language/direction,
SEO, CSP, accessibility, font and performance checks. Their
[shared fixture helpers](../e2e/website/helpers.ts) remain test infrastructure.
The SEO scenario's additional standalone process uses the reviewed readiness,
unlinked-file and direct-child lifecycle owners. Page behavior requires actual
execution on the proposed application tree; the false-marker gate does not run it.

Two [visual source files](../e2e/visual/website.spec.ts) describe the scenes and
[font-readiness expectations](../e2e/visual/readiness.ts). The visual configuration
retains its explicit viewport, reduced motion, browser/channel, snapshot naming
and existing pixel tolerances. CI baseline updates remain forbidden. Review
metadata must identify the matching platform, SDK/browser version and an actual
reviewer/time; update mode invalidates prior approval before capture can change
an image. An unsuccessful or partial capture must remain pending.

The published Windows PNGs and metadata retain their historical dates and bytes. They are baseline inputs, not current compatibility evidence. Exact-tree application acceptance must run compatible current captures and comparisons under the visual contract; missing or mismatched metadata is a failure. Do not refresh dates or approve a changed image without authorization and actual visual review. See [visual limits](visual-regression.md), [fonts](fonts.md) and [accessibility](accessibility.md).

Two operation files describe [release smoke](../e2e/operations/smoke.spec.ts) and
[staging acceptance](../e2e/operations/staging.spec.ts). They are authored
scenarios, not reports that either environment was contacted or passed.

## Actual verification and remaining work

The four Node owner files join measured governance coverage and source analysis.
They exercise readiness ordering with poisoned option/environment getters,
owned synthetic SDK manifests and fake CLI/module programs, explicit input
rejection, configuration contents, owned stopping and failure/cleanup paths.
These owner tests start no real browser, Next.js application, independent API or
Docker engine. Installed SDK types participate in strict compilation. The
false-marker profile does not execute authored browser cases or report them as
skipped successes; application acceptance requires their separate real execution.

Focused development checks may run the four Node owners:

```sh
node --test scripts/browser-inputs.test.mjs scripts/playwright-config.test.mjs scripts/visual.test.mjs scripts/test-csp-report-only.test.mjs
```

Before an authorized commit, push or PR handoff, fresh Node and pinned Python installation and the complete fifteen-check [canonical profile](../.agents/validation.json) must pass on the exact isolated application tree. Keep unit, governance and font thresholds, complete source closure and provider preflight. Node owner cases alone do not establish the profile’s actual build/browser/visual results. See [validation](validation.md), [testing](testing.md) and [test reliability](test-reliability.md).

Application activation must supply pages/layout/CSS, Knip, an independently
installed synthetic API, browser provisioning, applicable reviewed baselines and
real build, e2e and visual jobs. Observe those jobs passing and make them required
before a runnable merge. The preserved Docker smoke and Lighthouse launchers
belong to the separate operations acceptance; they do not replace the application
gate. These owners preserve the [runner limits](runner-foundation.md),
including direct-child ownership rather than descendant supervision, and does
not establish SSR, cookies in a browser, visual quality or a release.
