# Node runner foundation

[English](runner-foundation.md) · [فارسی](runner-foundation.fa.md)

## Source phase and activation

These process owners were introduced in the 317-file `runner-foundation` phase. The [source marker](../.github/bootstrap-policy.json) owns the current exact inventory and readiness. The application snapshot has complete runnable composition, `applicationReady:true` and a fifteen-check profile. Website, API, server and analyzer entries still validate readiness before environment/configuration reads, dependency resolution, output access or child creation; a false or invalid marker fails without a bypass. [Application acceptance](application.md) requires actual exact-tree execution and the protected merge transition, independently of structural readiness.

[Independent API fixture](api-fixture.md) defines the public pinned API adapter,
fresh owned state, launcher port contract and strict SDK worker control. Ordinary
imports remain inert: no dotenv loading, environment mutation, service startup or
installed CLI discovery occurs. The Node owner tests below establish process
contracts, independently of any later application/API/browser execution.

## Owners and contracts

| Owner                                                                         | Behavior                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [runner-process.mjs](../scripts/runner-process.mjs)                           | Starts one owned direct child with an explicit command, arguments, working directory and environment; reports spawn, exit, signal and cancellation failures and drains the close event. CLI signal listeners are scoped and removed. |
| [runner-inputs.mjs](../scripts/runner-inputs.mjs)                             | Checks readiness first, rejects dotenv presence without reading contents, derives an explicit public environment and validates local Next identity or the selected synthetic API script.                                             |
| [start-website.mjs](../scripts/start-website.mjs)                             | Validates explicit website settings, prepares the guarded standalone files and awaits its owned Node server.                                                                                                                         |
| [test-website-api.mjs](../scripts/test-website-api.mjs)                       | Requires explicit synthetic loopback settings and an absolute API fixture location, validates its fixed entry and awaits the owned Node fixture.                                                                                     |
| [test-website-server.mjs](../scripts/test-website-server.mjs)                 | Runs the selected root's verified Next build, prepares standalone files and serves only after success; explicit skip-build mode requires an existing guarded build ID.                                                               |
| [analyze-website-performance.mjs](../scripts/analyze-website-performance.mjs) | Runs the verified local Next analysis commands and writes bounded output to an exclusively created owned artifact; failure preserves unrelated existing files.                                                                       |

No public operation implicitly discovers another checkout. Next resolution uses
the selected website's exact manifest, lock and installed `node_modules/next`
identity/version, with unlinked paths; no parent/global CLI fallback is allowed.
The API resolver requires KERNEL_SYNTHETIC_ENV=1 and an explicit absolute KERNEL_API_DIRECTORY. It verifies the independent clean Git checkout at public revision 4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9 and matching manifest, lock and installed direct-dependency identities, then selects published src/index.ts. These checks do not attest all installed bytes or wire compatibility; real integration still requires the later application gate.

Environment input is explicit. Website settings include production `NODE_ENV`,
`API_BASE_URL`, `HOSTNAME` and `PORT`, with public website/indexing/CSP settings.
Only allowlisted runtime essentials and declared public settings reach children;
credentials, `NODE_OPTIONS` and the rest of the parent environment are omitted.
Synthetic execution additionally requires two distinct `http://127.0.0.1:PORT`
origins, a matching website host/port and explicit disabled indexing. No default
API origin or dotenv fallback is supplied.

The generic process helper is called after the entry operation has checked readiness; it does not own a source root or repeat that policy check. It owns the direct child object it created. Cancellation and
idempotent stopping use bounded termination, escalation and close draining on
that object; no global PID lookup, process-tree termination or unrelated process
cleanup is performed. This contract does not supervise child descendants.
Operators must independently provide containment for a future runtime requiring
descendant supervision. Filesystem checks assume a single writer and physical
unlinked roots; they do not make portable path operations race-proof.

## Actual verification

The six Node owner files are
[process lifecycle](../scripts/runner-process.test.mjs),
[inputs](../scripts/runner-inputs.test.mjs),
[standalone startup](../scripts/start-website.test.mjs),
[API startup](../scripts/test-website-api.test.mjs),
[build/server sequencing](../scripts/test-website-server.test.mjs) and
[analysis output](../scripts/analyze-website-performance.test.mjs).
Positive cases execute disposable Node programs inside owned synthetic projects
carrying explicit ready markers. They verify real child execution and failures,
not only mocked callbacks. Negative cases keep the false marker and prove inputs
and side effects remain untouched. Local files and processes belong to each test;
real dotenv, developer APIs, operator state and production are not fixtures.

The [canonical manifest](../.agents/validation.json) owns the complete fifteen-check application profile. These Node owners remain in measured governance coverage and Sonar through the existing source selectors, without exclusions or weaker thresholds. Focused development verification can run:

```sh
node --test scripts/runner-process.test.mjs scripts/runner-inputs.test.mjs scripts/start-website.test.mjs scripts/test-website-api.test.mjs scripts/test-website-server.test.mjs scripts/analyze-website-performance.test.mjs
```

An authorized commit, push or PR handoff requires fresh Node and pinned Python installation plus `npm run validate -- full` on the exact isolated tree. All 90 product modules, source-test ownership, operation-token activation guards and font checks remain in scope; see [session ownership](session.md).

Passing these Node owner tests establishes neither a real Next.js build/start nor
independent API compatibility, browser/CSP, accessibility, visual comparison,
Lighthouse, Docker or deployment. The [browser foundation](browser-foundation.md)
documents the SDK-backed authored suites and guarded orchestration. Any runnable
snapshot must meet the application contract and produce fresh exact-tree results;
before its merge, observe genuine build, e2e and visual jobs and make them required. See
[testing](testing.md), [validation](validation.md), [phase policy](bootstrap.md)
and [delivery acceptance](deployment.md).
