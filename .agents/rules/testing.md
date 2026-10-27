# Testing

The published phase uses Vitest, real React/RTL, next-intl, Radix and next-themes
with isolated jsdom, synthetic fetch responses and Node governance tests. Do not
introduce MSW, user-event or browser tooling as if it were already installed.

Select the smallest useful command from the
[validation manifest](../validation.json), following
[Contributing](../../CONTRIBUTING.md). Development checks do not replace the full
isolated-snapshot gate before an authorized commit, push or PR handoff. Preserve
all required coverage thresholds and source scope.

## Test boundaries

- Pure utility or wire mapper: test values and errors directly.
- Hook or provider: test lifecycle, cleanup, cancellation and stale results.
- Interactive component: test visible controls, submitted values and feedback.
- Guidance or tooling: test observable behavior in owned disposable fixtures.
- A purely presentational component normally needs no implementation-shaped test.

Read [forms](../../docs/forms.md), [session ownership](../../docs/session.md),
[client UI](../../docs/client-ui.md) and [architecture](../../docs/architecture.md).
Keep source tests beside their owners. Feature tests use explicit auth/account
message selections, the real HTTP client and SessionProvider; mock only framework
router and document navigation. Preserve the documented motion/framework-hook
mocks and static-markup limits. Test API failures using synthetic Requests,
Responses and fetch, never an existing service or dotenv configuration.

Prefer accessible selectors, roles, labels and visible text. Reuse small domain
fixtures. Await the observable completion of asynchronous behavior instead of
assuming that resolving a fetch promise finishes response-body parsing and React
updates. Test duplicate submissions and late success/failure across locale,
session generation, account replacement and unmount when those owners are affected.
Do not add sleeps, test retries, skipped cases or weaker assertions to hide a race.

## Evidence and future integration

Report actual commands, failures, source scope and limitations. Current tests do
not establish SSR, cookie isolation in a browser, keyboard/contrast compliance,
visual appearance or deployment. Future runnable integration must add and execute
real build, browser/CSP and visual checks with an independently installed
synthetic API fixture before those claims or a runnable-app merge.

Use temporary files and resources owned by the test. Verify the resolved target
before cleanup, include failure paths, and never delete or move another checkout,
private state, shared Docker resources or unrelated source. No production
endpoints, databases, storage or credentials belong in a fixture.

Independent quality-helper tests belong in required governance coverage. Use owned synthetic directories/build graphs, explicit API fixture paths and metadata/lock fixtures. Do not import deferred launchers or rely on sibling checkouts. Read [testing](../../docs/testing.md) and [validation](../../docs/validation.md); no browser or application execution is established by these Node cases.
