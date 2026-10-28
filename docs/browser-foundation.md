# Browser foundation and authored scenarios

[English](browser-foundation.md) · [فارسی](browser-foundation.fa.md)

## Current API fixture prerequisite

The api-fixture phase retains the non-runnable browser source and applicationReady:false, with an exact 348-file inventory and the same eleven-check gate. [Independent API fixture](api-fixture.md) defines the pinned public API adapter, fresh owned state, launcher port contract and strict SDK worker control. The foundation sections below retain their earlier phase scope; their prior structural-only API entry is superseded by the explicit revision/installation checks and published src/index.ts entry described in that guide. No real API/browser execution is established for this false snapshot. A later application PR needs its complete fifteen-check execution and protected merge transition.

The **browser-foundation** phase publishes the browser dependency and authored
scenario closure before application activation. Its exact maintained inventory
contains **348 files**. The public marker remains `applicationReady:false`.
There are no published Next.js pages, root layout or CSS pipeline to run, and no
real browser, API, Docker, Lighthouse, visual-comparison or deployment result is
claimed by this phase.

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

Playwright and its Axe integration are exact local development dependencies.
Strict [tooling typechecking](../tsconfig.tooling.json) includes all thirteen
authored e2e TypeScript files and four configurations against the installed SDK
types. This is compilation evidence, not a browser installation or execution.
The current full profile registers no browser, Lighthouse, Knip or deployment
execution command and creates no new provider workflow.

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

Browser provisioning is deferred; visual children use the selected installation's
project-local browser location. Neither installation of the npm SDK nor a fake
probe in an owner test establishes a provisioned browser.

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

The nine [website](../e2e/website/website.spec.ts) source files describe future
authentication/account, session isolation, client boundaries, language/direction,
SEO, CSP, accessibility, font and performance checks. Their
[shared fixture helpers](../e2e/website/helpers.ts) remain test infrastructure.
The SEO scenario's additional standalone process uses the reviewed readiness,
unlinked-file and direct-child lifecycle owners. Its page behavior is unexecuted.

Two [visual source files](../e2e/visual/website.spec.ts) describe the scenes and
[font-readiness expectations](../e2e/visual/readiness.ts). The visual configuration
retains its explicit viewport, reduced motion, browser/channel, snapshot naming
and existing pixel tolerances. CI baseline updates remain forbidden. Review
metadata must identify the matching platform, SDK/browser version and an actual
reviewer/time; update mode invalidates prior approval before capture can change
an image. An unsuccessful or partial capture must remain pending.

Previous PNGs and review metadata remain preserved historical material outside
this snapshot. This phase neither imports them as current evidence nor creates,
refreshes or approves a baseline. See [visual limits](visual-regression.md),
[fonts](fonts.md) and [accessibility](accessibility.md).

Two operation files describe [release smoke](../e2e/operations/smoke.spec.ts) and
[staging acceptance](../e2e/operations/staging.spec.ts). They are authored
scenarios, not reports that either environment was contacted or passed.

## Actual verification and remaining work

The four Node owner files join measured governance coverage and source analysis.
They exercise readiness ordering with poisoned option/environment getters,
owned synthetic SDK manifests and fake CLI/module programs, explicit input
rejection, configuration contents, owned stopping and failure/cleanup paths.
No test starts a real browser, Next.js application, independent API or Docker
engine. Installed SDK types participate in strict compilation; the authored
browser cases are not executed or reported as skipped successes.

Focused development checks may run the four Node owners:

```sh
node --test scripts/browser-inputs.test.mjs scripts/playwright-config.test.mjs scripts/visual.test.mjs scripts/test-csp-report-only.test.mjs
```

Before an authorized commit, push or PR handoff, fresh Node and pinned Python
installation and all eleven [canonical full checks](../.agents/validation.json)
must pass on the exact isolated proposed tree. Keep the existing unit,
governance and font thresholds, source closure and complete provider preflight.
See [validation](validation.md), [testing](testing.md) and
[test reliability](test-reliability.md).

The original Docker smoke launcher, Lighthouse performance launcher and Knip
configuration remain preserved for application activation. That later phase
must supply actual pages/layout/CSS, an independently installed synthetic API,
browser provisioning, applicable reviewed baselines and real build, e2e and
visual jobs. Observe those jobs passing and make them required before a runnable
merge. The current foundation preserves the [runner limits](runner-foundation.md),
including direct-child ownership rather than descendant supervision, and does
not establish SSR, cookies in a browser, visual quality or a release.
