# CSP helpers and runtime acceptance

[English](website-csp.md) · [فارسی](website-csp.fa.md)

The **integration-tooling** snapshot retains the pure [CSP helper](../src/shared/security/csp.ts)
and [owner tests](../src/shared/security/csp.test.ts). It does not publish a request
proxy adapter, nonce generator, root layout, browser fixture or gateway. No live
CSP response header or browser enforcement is established by this phase.

## Implemented contracts

readWebsiteCspMode accepts report-only/enforce and defaults an absent value to
report-only. createWebsiteCsp validates a supplied nonce and constructs a policy;
its development argument controls development allowances. Mode parsing and policy
construction are separate: choosing the reporting or enforcing response header
belongs to future runtime wiring. Report-only observation must not be described
as blocking a violation.

The policy restricts script/style elements using the supplied nonce and same-origin
rules. Style attributes deliberately retain the inline-style allowance for
React/Motion compatibility; that is not permission for arbitrary inline scripts.
Development alone permits unsafe-eval and WebSockets. The pure document-path
predicate distinguishes API/static/font/metadata paths, but does not establish a
framework matcher or response pipeline.

The helper does not generate randomness, strip caller nonce headers, attach
headers, render HTML or enforce cache behavior. [API forwarding](server-boundary.md)
separately protects listed routes, mutation origins, cookies and private no-store
responses. [JSON-LD](client-document.md) still needs escaped output; CSP replaces
neither API authorization nor safe rendering.

## Acceptance for a future runnable phase

Generate an unpredictable nonce per document, reject caller spoofing and provide
the same trusted value to framework, theme and JSON-LD output. Inspect initial
HTML and hydrated behavior: a library clearing its live nonce does not prove
its initial script was unprotected. Keep private nonce-bearing HTML out of shared
caches and test real document/API/static/metadata and missing-document boundaries.

Use the same verified production build for separate enforce/report-only browser
runs. Negative script/style cases need genuine response injection and trusted
controls; debugger evaluation alone is not CSP enforcement evidence. Record actual
headers, uniqueness, spoof rejection, theme/motion, cache behavior and failures.
Gateway/TLS wiring and any remote origin/collector need their own authorized
changes and tests. No such deployment is configured here.

Use [testing](testing.md) and [validation](validation.md). Source/unit behavior,
actual browser behavior and deployed security evidence are separate results.
