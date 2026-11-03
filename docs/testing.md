# Test repository governance

Read [source scope](bootstrap.md) and [the manifest](../.agents/validation.json).
The governance phase has ten actual required checks; run affected owner tests
while editing and the complete [exact-tree procedure](validation.md) before an
authorized commit, push or PR handoff.

The audit wrapper has a focused Vitest unit suite with its subprocess boundary
mocked; it does not contact the registry. Required online audit is separate.
Unit coverage remains 90% for all metrics. Node owner tests measure executable
governance helpers with 80% thresholds. Add no suppressions or source/rule/coverage
exclusions, fabricated coverage or metric-only wrappers.

CI displays unit and governance suites independently. Their manifest profiles
partition the complete local gate; `check` aggregates job outcomes and Sonar
consumes each suite's measured artifact without repeating tests. Dependency
audit and static checks run independently of those suites.

Use colocated `*.test.mjs` owner suites and explicitly named integration cases
for agreement across owners. Fixtures use synthetic public data and disposable
resources owned by the test. Verify observable failures, original errors,
cancellation, coverage artifact identity and cleanup.
Follow [test reliability](test-reliability.md).

The [boundary check](../scripts/check-boundaries.mjs) traces literal imports,
local bindings, literal container selections and explicit function return/yield
expressions. It also traces values from dynamic imports through the first
parameter and explicit returns of locally traceable `.then` callbacks. Review
argument flow through arbitrary calls and other callbacks manually. Keep module
namespaces and builtin loaders in explicit bindings inside their owning file.
A passing check supplies evidence for these supported syntax paths.

A passed local suite proves only the exercised source. It does not establish
hosted CI, Sonar binding or CodeRabbit approval. This phase requires no
application server, browser, Python/font verification or external backend.
Report actual commands, first failures/skips and limits in the task or terminal.
