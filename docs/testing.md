# Test the published source

Read [source scope](bootstrap.md) and [the manifest](../.agents/validation.json).
Run affected owner tests
while editing and the complete [exact-tree procedure](validation.md) before an
authorized commit, push or PR handoff.

The audit wrapper has a focused Vitest unit suite with its subprocess boundary
mocked; it does not contact the registry. Required online audit is separate.
Unit coverage remains 90% for all metrics. Node owner tests measure executable
governance helpers with 80% thresholds. Add no suppressions or source/rule/coverage
exclusions, fabricated coverage or metric-only wrappers.

CI displays unit, governance, application E2E, accessibility, SEO, CSP and visual
suites independently. Their manifest profiles partition the required
checks; `check` aggregates job outcomes and Sonar
consumes each suite's measured artifact without repeating tests. Dependency
audit and static checks run independently of those suites.

Use colocated `*.test.mjs` owner suites and explicitly named integration cases
for agreement across owners. Fixtures use synthetic public data and disposable
resources owned by the test. Verify observable failures, original errors,
cancellation, coverage artifact identity and cleanup.
Follow [test reliability](test-reliability.md).

Runner, browser and delivery owner tests exercise direct-child lifecycle, cancellation,
drain, explicit environments, artifact paths and failure cleanup. Only owned
synthetic roots may declare readiness to test these contracts. Separate cases
verify that the actual false-readiness boundary prevents operation input reads
and side effects. Imports must remain inert. See [runner contracts](runner-foundation.md),
[browser tooling](browser-foundation.md) and [deployment references](deployment.md).

The [HTTP fixture](api-fixture.md) tests use disposable in-memory accounts and
local requests. Stub Next executables and synthetic standalone outputs verify
runner ownership and sequencing, not compatibility with a real framework build.
Authored browser and visual suites are published with a required tooling
TypeScript project. Compilation checks compatibility with installed SDK types;
it does not execute the suites. Node browser-owner cases use synthetic SDK files
and disposable programs, not a real browser. These tests establish neither a
completed browser/visual comparison nor Docker or installed-service acceptance.
Retained baseline images describe historical captures.

Application acceptance must exercise the delivered website with this
repository's HTTP fixture and a verified browser. A single Windows build checks
unused source and bundle budgets, prepares standalone output and records its
admitted source inputs, synthetic environment, exact toolchain and output hashes.
Hosted browser jobs consume the immutable artifact from that successful build
attempt and verify it before running their disjoint profiles: 21 functional E2E,
8 accessibility, 17 SEO, 12 CSP and 4 visual scenarios. CSP retains six scenarios
in each of enforce and report-only mode. Font integrity remains in governance.
Local `full` runs the same checks sequentially under one writer and reuses that
verified build. False-marker guard tests
reject operations before configuration, dependencies or child startup; they do
not turn authored scenarios into passing or skipped browser results.
See [visual regression](visual-regression.md) for baseline review and update rules.

The [boundary check](../scripts/check-boundaries.mjs) traces literal imports,
local bindings, literal container selections and explicit function return/yield
expressions. It also traces values from dynamic imports through the first
parameter and explicit returns of locally traceable `.then` callbacks. Review
argument flow through arbitrary calls and other callbacks manually. Keep module
namespaces and builtin loaders in explicit bindings inside their owning file.
A passing check supplies evidence for these supported syntax paths.

A passed local suite proves only the exercised source. It does not establish
hosted CI, Sonar binding or CodeRabbit approval. This phase verifies the font binaries with the pinned Python environment.
The full application gate also requires a verified browser and disposable local
servers; no external backend is used as a test fixture.
Report actual commands, first failures/skips and limits in the task or terminal.
